import type { Insertable, Kysely, Transaction } from 'kysely';

/**
 * Options for configuring batch insert behavior.
 */
export interface BatchInsertOptions {
  /**
   * Number of records to insert per batch.
   *
   * @default 1000
   */
  batchSize?: number;
}

/**
 * Inserts records in batches to avoid SQL Server parameter limits and improve performance.
 *
 * SQL Server has a limit of 2100 parameters per query. When inserting many records
 * with multiple columns, you can quickly hit this limit. This utility automatically
 * chunks your inserts into batches to stay within limits while maximizing performance.
 *
 * For example, with 10 columns per record:
 * - Single insert of 1000 records = 10,000 parameters (exceeds limit)
 * - Batched inserts of 200 records = 2,000 parameters per batch (safe)
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to insert into
 * @param values - Array of records to insert
 * @param options - Optional configuration
 *
 * @example
 * Basic usage:
 * ```typescript
 * const products = [
 *   { name: 'Product 1', price: 10.99 },
 *   { name: 'Product 2', price: 20.99 },
 *   // ... 10,000 more products
 * ];
 *
 * await batchInsert(db, 'products', products);
 * // Automatically chunks into batches of 1000
 * ```
 *
 * @example
 * With custom batch size:
 * ```typescript
 * const users = [...]; // 5000 users
 *
 * await batchInsert(db, 'users', users, { batchSize: 500 });
 * // Executes 10 INSERT statements of 500 records each
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   // Insert users
 *   await batchInsert(tx, 'users', users);
 *
 *   // Insert related profiles
 *   await batchInsert(tx, 'user_profiles', profiles);
 *
 *   // All batches are part of the same transaction
 * });
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * try {
 *   await batchInsert(db, 'products', products, { batchSize: 1000 });
 *   console.log(`Successfully inserted ${products.length} products`);
 * } catch (error) {
 *   if (error instanceof DuplicateKeyError) {
 *     console.error('Some products already exist');
 *   }
 *   throw error;
 * }
 * ```
 *
 * @example
 * Large import with progress tracking:
 * ```typescript
 * const records = [...]; // 100,000 records
 * const batchSize = 1000;
 * const totalBatches = Math.ceil(records.length / batchSize);
 *
 * for (let i = 0; i < records.length; i += batchSize) {
 *   const batch = records.slice(i, i + batchSize);
 *   await batchInsert(db, 'large_table', batch, { batchSize });
 *   console.log(`Progress: ${Math.ceil(i / batchSize) + 1}/${totalBatches}`);
 * }
 * ```
 */
export async function batchInsert<DB, TB extends keyof DB & string>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Insertable<DB[TB]>[],
  options?: BatchInsertOptions,
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const batchSize = options?.batchSize ?? 1000;

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    await executor.insertInto(table).values(batch).execute();
  }
}
