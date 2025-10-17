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
 * Each record in the values array must include the key field (default: 'id')
 * which will be used to identify which record to update. The function executes
 * individual UPDATE statements for each record, batched to stay within SQL
 * Server's parameter limits.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to update
 * @param values - Array of records to update (must include key field)
 * @param options - Optional configuration
 *
 * @example
 * Basic usage:
 * ```typescript
 * const updates = [
 *   { id: 1, price: 19.99, stock: 50 },
 *   { id: 2, price: 29.99, stock: 30 },
 *   // ... 10,000 more updates
 * ];
 *
 * await batchUpdate(db, 'products', updates);
 * // Automatically chunks into batches of 1000
 * // Each batch: UPDATE products SET price=@1, stock=@2 WHERE id=@3 (repeated)
 * ```
 *
 * @example
 * With custom batch size:
 * ```typescript
 * const userUpdates = [...]; // 5000 users
 *
 * await batchUpdate(db, 'users', userUpdates, { batchSize: 500 });
 * // Executes 10 batches of 500 UPDATE statements each
 * ```
 *
 * @example
 * With custom key field:
 * ```typescript
 * const updates = [
 *   { email: 'user1@example.com', status: 'active' },
 *   { email: 'user2@example.com', status: 'inactive' },
 * ];
 *
 * await batchUpdate(db, 'users', updates, { key: 'email' });
 * // Uses email as the WHERE clause identifier
 * ```
 *
 * @example
 * With composite key (multiple fields):
 * ```typescript
 * const updates = [
 *   { userType: 'admin', active: true, permissions: 'full' },
 *   { userType: 'user', active: true, permissions: 'limited' },
 *   { userType: 'guest', active: false, permissions: 'read' },
 * ];
 *
 * await batchUpdate(db, 'user_settings', updates, {
 *   key: ['userType', 'active']
 * });
 * // WHERE userType=@1 AND active=@2
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   // Update products
 *   await batchUpdate(tx, 'products', productUpdates);
 *
 *   // Update inventory
 *   await batchUpdate(tx, 'inventory', inventoryUpdates);
 *
 *   // All batches are part of the same transaction
 * });
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * try {
 *   await batchUpdate(db, 'products', updates, { batchSize: 1000 });
 *   console.log(`Successfully updated ${updates.length} products`);
 * } catch (error) {
 *   if (error instanceof ForeignKeyError) {
 *     console.error('Some updates reference invalid foreign keys');
 *   }
 *   throw error;
 * }
 * ```
 *
 * @example
 * Partial updates:
 * ```typescript
 * const updates = [
 *   { id: 1, stock: 45 },        // Only update stock
 *   { id: 2, price: 15.99 },     // Only update price
 *   { id: 3, stock: 30, price: 25.99 }, // Update both
 * ];
 *
 * await batchUpdate(db, 'products', updates);
 * // Each record updates only the fields provided
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
