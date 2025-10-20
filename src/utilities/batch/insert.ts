import type { Insertable, Kysely, Transaction } from 'kysely';
import { type BatchResult, withAutoTransaction } from './batch-kysely.js';
import { calculateOptimalBatchSize } from './shared.js';

/**
 * Inserts records in batches to avoid SQL Server parameter limits.
 *
 * SQL Server has a limit of 2100 parameters per query. This utility automatically
 * calculates the optimal batch size based on your record structure to maximize
 * performance while staying within the parameter limit.
 *
 * **Atomic by default:** The entire operation is automatically wrapped in a transaction.
 * If any batch fails, ALL batches are rolled back (all-or-nothing). If called within
 * an existing transaction, uses that transaction (no nesting).
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to insert into
 * @param values - Array of records to insert. **Empty array is a no-op** (returns immediately).
 * @returns Metadata about the batch operation
 *
 * @throws {Error} Propagates any database errors (entire operation rolls back)
 *
 * @remarks
 * **Edge Cases:**
 * - Empty array: Returns immediately without executing any queries
 * - Single record: Executes a single INSERT statement (still atomic)
 * - Automatic batch sizing: Always uses optimal batch size based on column count
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
 * const result = await batchInsert(db, 'products', [
 *   { name: 'Product 1', price: 10.99 },
 *   { name: 'Product 2', price: 20.99 },
 * ]);
 * console.log(`Inserted ${result.totalRecords} records in ${result.batchCount} batches`);
 * ```
 *
 * @example
 * Within an explicit transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchInsert(tx, 'users', users);
 *   await batchInsert(tx, 'user_profiles', profiles);
 *   // All inserts use the same transaction - atomic across both tables
 * });
 * ```
 */
export async function batchInsert<DB, TB extends keyof DB & string>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Insertable<DB[TB]>[],
): Promise<BatchResult> {
  if (values.length === 0) {
    return { totalRecords: 0, batchCount: 0 };
  }

  return withAutoTransaction(executor, async (tx) => {
    const batchSize = calculateOptimalBatchSize(values as readonly Record<string, unknown>[]);
    let batchCount = 0;

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      await tx.insertInto(table).values(batch).execute();
      batchCount++;
    }

    return {
      totalRecords: values.length,
      batchCount,
    };
  });
}
