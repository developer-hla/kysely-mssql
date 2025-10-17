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
 * Inserts records in batches to avoid SQL Server parameter limits.
 *
 * SQL Server has a limit of 2100 parameters per query. This utility automatically
 * chunks inserts into batches to stay within limits.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to insert into
 * @param values - Array of records to insert
 * @param options - Optional configuration
 *
 * @example
 * Basic usage:
 * ```typescript
 * await batchInsert(db, 'products', [
 *   { name: 'Product 1', price: 10.99 },
 *   { name: 'Product 2', price: 20.99 },
 * ]);
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchInsert(tx, 'users', users);
 *   await batchInsert(tx, 'user_profiles', profiles);
 * });
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
