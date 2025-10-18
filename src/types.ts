import type { Kysely, Transaction } from 'kysely';

/**
 * Utility type for functions that can work with either a database instance or a transaction.
 *
 * This type is commonly used in composable transactional functions.
 *
 * @example
 * ```typescript
 * import { type Executor } from '@dev-hla/kysely-mssql';
 *
 * async function createUser(
 *   executor: Executor<Database>,
 *   params: CreateUserParams
 * ) {
 *   return executor.insertInto('users').values(params).execute();
 * }
 *
 * // Usage 1: With database
 * await createUser(db, params);
 *
 * // Usage 2: Within transaction
 * await db.transaction().execute(async (tx) => {
 *   await createUser(tx, params);
 * });
 * ```
 */
export type Executor<DB> = Kysely<DB> | Transaction<DB>;
