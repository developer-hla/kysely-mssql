import type { Kysely, Transaction } from 'kysely';

/**
 * Executes a callback within a database transaction, either creating a new
 * transaction or reusing an existing one.
 *
 * This utility enables composable transactional functions that can work both
 * standalone (creating their own transaction) and as part of a larger transaction
 * (reusing an existing transaction context).
 *
 * @template DB - The database schema type
 * @template T - The return type of the callback
 *
 * @param executor - Either a Kysely database instance or an existing Transaction
 * @param callback - Function to execute within the transaction context
 *
 * @returns The result of the callback function
 * @throws Will propagate any errors from the callback, rolling back the transaction
 *
 * @example
 * Basic usage - function works standalone or within transaction:
 * ```typescript
 * async function createUser(
 *   executor: Kysely<Database> | Transaction<Database>,
 *   params: { name: string; email: string }
 * ) {
 *   return wrapInTransaction(executor, async (tx) => {
 *     return tx
 *       .insertInto('users')
 *       .values(params)
 *       .returning(['id', 'name', 'email'])
 *       .executeTakeFirstOrThrow();
 *   });
 * }
 *
 * // Usage 1: Standalone (creates transaction automatically)
 * const user = await createUser(db, { name: 'John', email: 'john@example.com' });
 *
 * // Usage 2: Within existing transaction (reuses transaction)
 * await db.transaction().execute(async (tx) => {
 *   const user = await createUser(tx, { name: 'Jane', email: 'jane@example.com' });
 *   const profile = await createUserProfile(tx, { userId: user.id, bio: 'Hello' });
 *   // Both operations in same transaction!
 * });
 * ```
 *
 * @example
 * Building composable transactional functions:
 * ```typescript
 * async function createPlot(
 *   executor: Kysely<DB> | Transaction<DB>,
 *   params: PlotParams
 * ) {
 *   return wrapInTransaction(executor, async (tx) => {
 *     // Create plot
 *     const plot = await tx
 *       .insertInto('plots')
 *       .values(params)
 *       .returning(['id'])
 *       .executeTakeFirstOrThrow();
 *
 *     // Create related entities (all composable!)
 *     await createPlotCooperator(tx, { plotId: plot.id, ...params.cooperator });
 *     await createPlotPreference(tx, { plotId: plot.id, ...params.preference });
 *
 *     return plot;
 *   });
 * }
 *
 * async function createPlotCooperator(
 *   executor: Kysely<DB> | Transaction<DB>,
 *   params: CooperatorParams
 * ) {
 *   return wrapInTransaction(executor, async (tx) => {
 *     return tx.insertInto('cooperators').values(params).execute();
 *   });
 * }
 * ```
 */
export async function wrapInTransaction<DB, T>(
  executor: Kysely<DB> | Transaction<DB>,
  callback: (tx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  if (executor.isTransaction) {
    return callback(executor as Transaction<DB>);
  }

  return (executor as Kysely<DB>).transaction().execute(callback);
}
