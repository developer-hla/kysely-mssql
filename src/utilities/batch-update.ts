import type { Kysely, Transaction, Updateable } from 'kysely';

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
 * Updates records in batches to avoid SQL Server parameter limits.
 *
 * Each record must include the key field (default: 'id') to identify which
 * record to update. Executes individual UPDATE statements batched to stay
 * within SQL Server's parameter limits.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to update
 * @param values - Array of records to update (must include key field)
 * @param options - Optional configuration
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

    for (const record of batch) {
      const typedRecord = record as Record<string, unknown>;

      for (const key of keys) {
        const keyValue = typedRecord[key];
        if (keyValue === undefined) {
          throw new Error(`Key field '${key}' is missing in update object`);
        }
      }

      const updateData = { ...typedRecord };
      for (const key of keys) {
        delete updateData[key];
      }

      let query = executor.updateTable(table).set(updateData as any);

      for (const key of keys) {
        const keyValue = typedRecord[key];
        query = query.where(key as any, '=', keyValue);
      }

      await query.execute();
    }
  }
}
