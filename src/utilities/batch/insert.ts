import type { Insertable, Kysely, Transaction } from 'kysely';
import { calculateOptimalBatchSize } from './shared.js';

/**
 * Inserts records in batches to avoid SQL Server parameter limits.
 *
 * SQL Server has a limit of 2100 parameters per query. This utility automatically
 * calculates the optimal batch size based on your record structure to maximize
 * performance while staying within the parameter limit.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to insert into
 * @param values - Array of records to insert. **Empty array is a no-op** (returns immediately).
 *
 * @throws {Error} Propagates any database errors from the insert operations
 *
 * @remarks
 * **Edge Cases:**
 * - Empty array: Returns immediately without executing any queries
 * - Single record: Executes a single INSERT statement
 * - Automatic batch sizing: Always uses optimal batch size based on column count
 *
 * **Performance:** Automatically uses the largest safe batch size for your record
 * structure. For example:
 * - 5 columns → batch size 400 (2000 parameters)
 * - 10 columns → batch size 200 (2000 parameters)
 * - 50 columns → batch size 40 (2000 parameters)
 *
 * @example
 * Basic usage with automatic batch sizing:
 * ```typescript
 * await batchInsert(db, 'products', [
 *   { name: 'Product 1', price: 10.99 },
 *   { name: 'Product 2', price: 20.99 },
 * ]);
 * // Automatically calculates optimal batch size based on column count
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
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const batchSize = calculateOptimalBatchSize(values[0] as Record<string, unknown>);

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    await executor.insertInto(table).values(batch).execute();
  }
}
