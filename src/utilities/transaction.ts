import type { Kysely, Transaction } from 'kysely';

/**
 * Options for wrapping a callback in a transaction.
 */
export interface TransactionOptions<DB, T> {
  /** The Kysely database instance */
  db: Kysely<DB>;
  /** Function to execute within the transaction */
  callback: (tx: Transaction<DB>) => Promise<T>;
  /** Optional existing transaction to reuse */
  previousTransaction?: Transaction<DB>;
}

/**
 * Executes a callback within a database transaction.
 *
 * If a previous transaction is provided, it will reuse that transaction.
 * Otherwise, it will create a new transaction.
 *
 * This enables composable transactional functions - functions can work
 * standalone (creating their own transaction) or participate in a larger
 * transaction (reusing an existing one).
 *
 * @param options - Transaction options
 * @param options.db - The Kysely database instance
 * @param options.callback - Function to execute within the transaction
 * @param options.previousTransaction - Optional existing transaction to reuse
 * @returns The result of the callback function
 * @throws Will propagate any errors from the callback, rolling back the transaction
 *
 * @example
 * Standalone function that creates its own transaction:
 * ```typescript
 * async function createUser(
 *   params: CreateUserParams,
 *   tx?: Transaction<Database>
 * ) {
 *   return wrapInTransaction({
 *     db: database,
 *     callback: async (transaction) => {
 *       const user = await transaction
 *         .insertInto('users')
 *         .values(params)
 *         .returning(['id', 'name'])
 *         .executeTakeFirstOrThrow();
 *
 *       return user;
 *     },
 *     previousTransaction: tx,
 *   });
 * }
 *
 * // Usage 1: Standalone (creates transaction)
 * const user = await createUser({ name: 'John', email: 'john@example.com' });
 *
 * // Usage 2: Within existing transaction (reuses it)
 * await database.transaction().execute(async (tx) => {
 *   const user = await createUser({ name: 'Jane', email: 'jane@example.com' }, tx);
 *   const profile = await createUserProfile({ userId: user.id }, tx);
 *   // Both operations in same transaction!
 * });
 * ```
 *
 * @example
 * Building composable transactional functions:
 * ```typescript
 * async function createPlot(params: PlotParams, tx?: Transaction<DB>) {
 *   return wrapInTransaction({
 *     db,
 *     callback: async (transaction) => {
 *       // Create plot
 *       const plot = await transaction
 *         .insertInto('plots')
 *         .values(params)
 *         .returning(['id'])
 *         .executeTakeFirstOrThrow();
 *
 *       // Create related entities (all composable!)
 *       await createPlotCooperator({ plotId: plot.id, ...params.cooperator }, transaction);
 *       await createPlotPreference({ plotId: plot.id, ...params.preference }, transaction);
 *       await createPlotEvent({ plotId: plot.id, eventType: 'Created' }, transaction);
 *
 *       return plot;
 *     },
 *     previousTransaction: tx,
 *   });
 * }
 *
 * async function createPlotCooperator(params: CooperatorParams, tx?: Transaction<DB>) {
 *   return wrapInTransaction({
 *     db,
 *     callback: async (transaction) => {
 *       return transaction.insertInto('cooperators').values(params).execute();
 *     },
 *     previousTransaction: tx,
 *   });
 * }
 * ```
 */
export async function wrapInTransaction<DB, T>({
  db,
  callback,
  previousTransaction,
}: TransactionOptions<DB, T>): Promise<T> {
  // If we have an existing transaction, reuse it
  if (previousTransaction) {
    return callback(previousTransaction);
  }

  // Otherwise, create a new transaction
  return db.transaction().execute(callback);
}
