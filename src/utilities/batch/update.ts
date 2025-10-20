import type { Kysely, Transaction, Updateable } from 'kysely';
import { type BatchResult, withAutoTransaction } from './batch-kysely.js';
import { calculateOptimalBatchSize, createValuesSource, validateKeyFields } from './shared.js';

/**
 * Options for configuring batch update behavior.
 */
export interface BatchUpdateOptions<K extends string = string> {
  /**
   * The column name(s) to use as the unique identifier for matching records.
   *
   * These fields must be present in each update object and will be used in
   * the MERGE ON clause to identify which records to update.
   *
   * Can be a single column name or an array of column names for composite keys.
   *
   * **Required** - no assumptions are made about your schema structure.
   */
  key: K | readonly K[];
}

/**
 * Updates records in batches using SQL Server's MERGE statement for optimal bulk performance.
 *
 * Each record must include the key field specified in options to identify which
 * record to update. Uses MERGE statement to perform true bulk updates instead
 * of individual UPDATE statements.
 *
 * **Atomic by default:** The entire operation is automatically wrapped in a transaction.
 * If any batch fails, ALL batches are rolled back (all-or-nothing). If called within
 * an existing transaction, uses that transaction (no nesting).
 *
 * Automatically calculates the optimal batch size based on SQL Server's 2100 parameter
 * limit and the number of columns in your records to maximize performance.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to update
 * @param values - Array of records to update (must include key field). **Empty array is a no-op** (returns immediately).
 * @param options - Configuration with **required** `key` field
 * @returns Metadata about the batch operation
 *
 * @throws {Error} When a key field is missing from an update object
 * @throws {Error} Propagates any database errors (entire operation rolls back)
 *
 * @remarks
 * **Edge Cases:**
 * - Empty array: Returns immediately without executing any queries
 * - Single record: Executes a single MERGE statement (still atomic)
 * - Missing key field: Throws error immediately when detected during validation
 * - Automatic batch sizing: Calculates optimal size based on column count
 *
 * **Key field is required** - no assumptions are made about your schema structure.
 * Explicitly specify which field(s) uniquely identify records.
 *
 * **Performance:** Uses SQL Server's MERGE statement for true bulk updates. Much faster
 * than individual UPDATE statements for large datasets. Automatically uses the largest
 * safe batch size for your record structure.
 *
 * @example
 * Basic usage (atomic by default):
 * ```typescript
 * const result = await batchUpdate(db, 'products', [
 *   { id: 1, price: 19.99, stock: 50 },
 *   { id: 2, price: 29.99, stock: 30 },
 * ], { key: 'id' });
 * console.log(`Updated ${result.totalRecords} records in ${result.batchCount} batches`);
 * ```
 *
 * @example
 * Composite key for multi-column matching:
 * ```typescript
 * await batchUpdate(db, 'user_settings', updates, {
 *   key: ['userId', 'settingKey']
 * });
 * // ON source.userId = target.userId AND source.settingKey = target.settingKey
 * ```
 *
 * @example
 * Within an explicit transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchUpdate(tx, 'products', productUpdates, { key: 'productId' });
 *   await batchUpdate(tx, 'inventory', inventoryUpdates, { key: 'sku' });
 *   // All updates use the same transaction - atomic across both tables
 * });
 * ```
 */
export async function batchUpdate<
  DB,
  TB extends keyof DB & string,
  K extends keyof DB[TB] & string,
>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Updateable<DB[TB]>[],
  options: BatchUpdateOptions<K>,
): Promise<BatchResult> {
  if (values.length === 0) {
    return { totalRecords: 0, batchCount: 0 };
  }

  return withAutoTransaction(executor, async (tx) => {
    const keyOption = options.key;
    const keys = (Array.isArray(keyOption) ? keyOption : [keyOption]) as readonly K[];

    const batchSize = calculateOptimalBatchSize(values as readonly Record<string, unknown>[]);
    let batchCount = 0;

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const typedBatch = batch as Record<string, unknown>[];

      // Validate that all records have the required key fields
      validateKeyFields(typedBatch, keys, i, 'update');

      // Extract all columns and determine update columns (exclude key fields)
      const allColumns = Object.keys(typedBatch[0]) as (keyof DB[TB] & string)[];
      const updateColumns = allColumns.filter((col) => !keys.includes(col as K));
      const valuesSource = createValuesSource(typedBatch, 'source');

      // Use MERGE for bulk updates (different logic for single vs composite keys)
      if (keys.length === 1) {
        const key = keys[0];

        await tx
          .mergeInto(table)
          // Type assertion required: Kysely's MERGE types don't support dynamic table references from VALUES
          .using(valuesSource as any, `source.${key}` as any, `${table}.${key}` as any)
          .whenMatched()
          // Type assertion required: Dynamic column references in UPDATE SET clause
          .thenUpdateSet((eb: any) => {
            const updates: Partial<Record<string, unknown>> = {};
            for (const col of updateColumns) {
              updates[col] = eb.ref(`source.${col}`);
            }
            return updates as any;
          })
          .execute();
      } else {
        // Composite key: use complex ON clause
        await tx
          .mergeInto(table)
          // Type assertion required: Kysely's MERGE types don't support dynamic table references from VALUES
          .using(valuesSource as any, (eb: any) => {
            const conditions = keys.map((key) =>
              eb(`source.${key}`, '=', eb.ref(`${table}.${key}`)),
            );
            return eb.and(conditions);
          })
          .whenMatched()
          // Type assertion required: Dynamic column references in UPDATE SET clause
          .thenUpdateSet((eb: any) => {
            const updates: Partial<Record<string, unknown>> = {};
            for (const col of updateColumns) {
              updates[col] = eb.ref(`source.${col}`);
            }
            return updates as any;
          })
          .execute();
      }

      batchCount++;
    }

    return {
      totalRecords: values.length,
      batchCount,
    };
  });
}
