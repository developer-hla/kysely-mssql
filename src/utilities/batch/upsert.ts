import type { Insertable, Kysely, Transaction } from 'kysely';
import { type BatchResult, withAutoTransaction } from './batch-kysely.js';
import { calculateOptimalBatchSize, createValuesSource, validateKeyFields } from './shared.js';

/**
 * Options for configuring batch upsert behavior.
 */
export interface BatchUpsertOptions<K extends string = string> {
  /**
   * The column name(s) to use as the unique identifier for matching records.
   *
   * These fields must be present in each upsert object and will be used in
   * the MERGE ON clause to identify which records to update vs insert.
   *
   * Can be a single column name or an array of column names for composite keys.
   *
   * **Required** - no assumptions are made about your schema structure.
   */
  key: K | readonly K[];
}

/**
 * Upserts (insert or update) records in batches using SQL Server's MERGE statement.
 *
 * For each record, if a matching row exists (based on key fields), it updates the row.
 * If no match exists, it inserts a new row. Uses SQL Server's MERGE statement for
 * optimal bulk upsert performance.
 *
 * **Atomic by default:** The entire operation is automatically wrapped in a transaction.
 * If any batch fails, ALL batches are rolled back (all-or-nothing). If called within
 * an existing transaction, uses that transaction (no nesting).
 *
 * Automatically calculates the optimal batch size based on SQL Server's 2100 parameter
 * limit and the number of columns in your records to maximize performance.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to upsert into
 * @param values - Array of records to upsert (must include key field(s)). **Empty array is a no-op** (returns immediately).
 * @param options - Configuration with **required** `key` field
 * @returns Metadata about the batch operation
 *
 * @throws {Error} When a key field is missing from an upsert object
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
 * **Performance:** Automatically uses the largest safe batch size for your record
 * structure. For example:
 * - 5 columns → batch size 400 (2000 parameters)
 * - 10 columns → batch size 200 (2000 parameters)
 * - 50 columns → batch size 40 (2000 parameters)
 *
 * @example
 * Basic usage (atomic by default):
 * ```typescript
 * const result = await batchUpsert(db, 'products', [
 *   { id: 1, name: 'Product 1', price: 19.99 },
 *   { id: 999, name: 'New Product', price: 39.99 }
 * ], { key: 'id' });
 * // Updates product 1 if exists, inserts product 999
 * console.log(`Upserted ${result.totalRecords} records in ${result.batchCount} batches`);
 * ```
 *
 * @example
 * Composite key for multi-column matching:
 * ```typescript
 * await batchUpsert(db, 'user_settings', settings, {
 *   key: ['userId', 'settingKey']
 * });
 * // MERGE ON target.userId = source.userId AND target.settingKey = source.settingKey
 * ```
 *
 * @example
 * Within an explicit transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchUpsert(tx, 'products', productUpdates, { key: 'productId' });
 *   await batchUpsert(tx, 'inventory', inventoryUpdates, { key: 'sku' });
 *   // All upserts use the same transaction - atomic across both tables
 * });
 * ```
 */
export async function batchUpsert<
  DB,
  TB extends keyof DB & string,
  K extends keyof DB[TB] & string,
>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Insertable<DB[TB]>[],
  options: BatchUpsertOptions<K>,
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
      validateKeyFields(typedBatch, keys, i, 'upsert');

      const allColumns = Object.keys(typedBatch[0]) as (keyof DB[TB] & string)[];
      const updateColumns = allColumns.filter((col) => !keys.includes(col as K));
      const valuesSource = createValuesSource(typedBatch, 'source');

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
          .whenNotMatched()
          // Type assertion required: Dynamic column references in INSERT VALUES clause
          .thenInsertValues((eb: any) => {
            const inserts: Partial<Record<string, unknown>> = {};
            for (const col of allColumns) {
              inserts[col] = eb.ref(`source.${col}`);
            }
            return inserts as any;
          })
          .execute();
      } else {
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
          .whenNotMatched()
          // Type assertion required: Dynamic column references in INSERT VALUES clause
          .thenInsertValues((eb: any) => {
            const inserts: Partial<Record<string, unknown>> = {};
            for (const col of allColumns) {
              inserts[col] = eb.ref(`source.${col}`);
            }
            return inserts as any;
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
