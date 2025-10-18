import type { AliasedRawBuilder, Kysely, Transaction, Updateable } from 'kysely';
import { sql } from 'kysely';

/**
 * Options for configuring batch update behavior.
 */
export interface BatchUpdateOptions<K extends string = string> {
  /**
   * Number of records to update per batch.
   *
   * @default 1000
   */
  batchSize?: number;

  /**
   * The column name(s) to use as the unique identifier for matching records.
   *
   * These fields must be present in each update object and will be used in
   * the WHERE clause to identify which record to update.
   *
   * Can be a single column name or an array of column names for composite keys.
   *
   * @default 'id'
   */
  key?: K | readonly K[];
}

/**
 * Update object that includes the key field for identifying the record.
 */
export type UpdateObjectWithKey<T, K extends keyof T> = Updateable<T> & Required<Pick<T, K>>;

/**
 * Helper function to create a VALUES table constructor for use in MERGE USING clause.
 * Transforms an array of records into a SQL VALUES expression with column aliases.
 *
 * @internal
 * @example
 * ```typescript
 * const data = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' }
 * ];
 * const source = createValuesSource(data, 'source');
 * // SQL: (VALUES (1, 'Alice'), (2, 'Bob')) AS source(id, name)
 * ```
 */
function createValuesSource<R extends Record<string, unknown>, A extends string>(
  records: R[],
  alias: A,
): AliasedRawBuilder<R, A> {
  const keys = Object.keys(records[0]);

  const valueRows = sql.join(
    records.map((record) => {
      const values = sql.join(
        keys.map((key) => sql`${sql.val(record[key])}`),
        sql`, `,
      );
      return sql`(${values})`;
    }),
    sql`, `,
  );

  const wrappedAlias = sql.ref(alias);
  const wrappedColumns = sql.join(keys.map(sql.ref), sql`, `);
  const aliasSql = sql`${wrappedAlias}(${wrappedColumns})`;

  return sql<R>`(VALUES ${valueRows})`.as<A>(aliasSql);
}

/**
 * Updates records in batches using SQL Server's MERGE statement for optimal bulk performance.
 *
 * Each record must include the key field (default: 'id') to identify which
 * record to update. Uses MERGE statement to perform true bulk updates instead
 * of individual UPDATE statements.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to update
 * @param values - Array of records to update (must include key field). **Empty array is a no-op** (returns immediately).
 * @param options - Optional configuration
 *
 * @throws {Error} When a key field is missing from an update object
 * @throws {Error} Propagates any database errors from the MERGE operation
 *
 * @remarks
 * **Edge Cases:**
 * - Empty array: Returns immediately without executing any queries
 * - Single record: Executes a single MERGE statement
 * - Missing key field: Throws error immediately when detected during validation
 *
 * **For tables without 'id' field:** You must explicitly specify the `key` option.
 *
 * **Performance:** Uses SQL Server's MERGE statement for true bulk updates. Much faster
 * than individual UPDATE statements for large datasets.
 *
 * @example
 * Basic usage:
 * ```typescript
 * await batchUpdate(db, 'products', [
 *   { id: 1, price: 19.99, stock: 50 },
 *   { id: 2, price: 29.99, stock: 30 },
 * ]);
 * ```
 *
 * @example
 * Composite key for multi-column matching:
 * ```typescript
 * await batchUpdate(db, 'user_settings', updates, {
 *   key: ['userId', 'settingKey']
 * });
 * // WHERE userId=@1 AND settingKey=@2
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchUpdate(tx, 'products', productUpdates);
 *   await batchUpdate(tx, 'inventory', inventoryUpdates);
 * });
 * ```
 */
export async function batchUpdate<
  DB,
  TB extends keyof DB & string,
  K extends keyof DB[TB] & string = Extract<keyof DB[TB] & string, 'id'>,
>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Updateable<DB[TB]>[],
  options?: BatchUpdateOptions<K>,
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const batchSize = options?.batchSize ?? 1000;
  const keyOption = (options?.key ?? 'id') as K | readonly K[];
  const keys = (Array.isArray(keyOption) ? keyOption : [keyOption]) as readonly K[];

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const typedBatch = batch as Record<string, unknown>[];

    // Validate that all records have the required key fields
    typedBatch.forEach((record, recordIndex) => {
      for (const key of keys) {
        const keyValue = record[key];
        if (keyValue === undefined) {
          const absoluteIndex = i + recordIndex;
          throw new Error(
            `Key field '${key}' is missing in update object at index ${absoluteIndex}. Record: ${JSON.stringify(record).slice(0, 200)}`,
          );
        }
      }
    });

    // Extract all columns and determine update columns (exclude key fields)
    const allColumns = Object.keys(typedBatch[0]) as (keyof DB[TB] & string)[];
    const updateColumns = allColumns.filter((col) => !keys.includes(col as K));
    const valuesSource = createValuesSource(typedBatch, 'source');

    // Use MERGE for bulk updates (different logic for single vs composite keys)
    if (keys.length === 1) {
      const key = keys[0];

      await executor
        .mergeInto(table)
        .using(valuesSource as any, `source.${key}` as any, `${table}.${key}` as any)
        .whenMatched()
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
      await executor
        .mergeInto(table)
        .using(valuesSource as any, (eb: any) => {
          const conditions = keys.map((key) => eb(`source.${key}`, '=', eb.ref(`${table}.${key}`)));
          return eb.and(conditions);
        })
        .whenMatched()
        .thenUpdateSet((eb: any) => {
          const updates: Partial<Record<string, unknown>> = {};
          for (const col of updateColumns) {
            updates[col] = eb.ref(`source.${col}`);
          }
          return updates as any;
        })
        .execute();
    }
  }
}
