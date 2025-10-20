/**
 * Batch-aware Kysely types and utilities.
 *
 * This module provides infrastructure for adding batch operation methods
 * to Kysely instances automatically. All connections created via createConnection()
 * are wrapped to include batchInsert, batchUpdate, and batchUpsert methods.
 */

import type { Insertable, Kysely, Transaction, Updateable } from 'kysely';

/**
 * Result returned from batch operations.
 */
export interface BatchResult {
  /**
   * Total number of records processed across all batches.
   */
  totalRecords: number;

  /**
   * Number of database round trips (batches) executed.
   */
  batchCount: number;
}

/**
 * Batch operation methods available on Kysely and Transaction instances.
 */
export interface BatchMethods<DB> {
  /**
   * Insert records in batches, automatically handling SQL Server's parameter limit.
   *
   * **Atomic by default:** The entire operation is wrapped in a transaction.
   * If any batch fails, all batches are rolled back (all-or-nothing).
   *
   * @param table - Table name to insert into
   * @param values - Array of records to insert
   * @returns Metadata about the batch operation
   *
   * @throws {Error} Propagates database errors (entire operation rolls back)
   *
   * @example
   * ```typescript
   * const result = await db.batchInsert('users', largeUserArray);
   * console.log(`Inserted ${result.totalRecords} users in ${result.batchCount} batches`);
   * ```
   */
  batchInsert<TB extends keyof DB & string>(
    table: TB,
    values: readonly Insertable<DB[TB]>[],
  ): Promise<BatchResult>;

  /**
   * Update records in batches using SQL Server's MERGE statement.
   *
   * **Atomic by default:** The entire operation is wrapped in a transaction.
   * If any batch fails, all batches are rolled back (all-or-nothing).
   *
   * @param table - Table name to update
   * @param values - Array of records to update (must include key fields)
   * @param options - Configuration specifying the key field(s) for matching
   * @returns Metadata about the batch operation
   *
   * @throws {Error} When key fields are missing or database errors occur
   *
   * @example
   * ```typescript
   * await db.batchUpdate('users', updates, { key: 'id' });
   * ```
   */
  batchUpdate<TB extends keyof DB & string>(
    table: TB,
    values: readonly Updateable<DB[TB]>[],
    options: { key: (keyof DB[TB] & string) | readonly (keyof DB[TB] & string)[] },
  ): Promise<BatchResult>;

  /**
   * Upsert records in batches using SQL Server's MERGE statement.
   *
   * **Atomic by default:** The entire operation is wrapped in a transaction.
   * If any batch fails, all batches are rolled back (all-or-nothing).
   *
   * @param table - Table name to upsert into
   * @param values - Array of records to upsert (must include key fields)
   * @param options - Configuration specifying the key field(s) for matching
   * @returns Metadata about the batch operation
   *
   * @throws {Error} When key fields are missing or database errors occur
   *
   * @example
   * ```typescript
   * await db.batchUpsert('products', products, { key: 'sku' });
   * ```
   */
  batchUpsert<TB extends keyof DB & string>(
    table: TB,
    values: readonly Insertable<DB[TB]>[],
    options: { key: (keyof DB[TB] & string) | readonly (keyof DB[TB] & string)[] },
  ): Promise<BatchResult>;
}

/**
 * Kysely instance with batch operation support.
 *
 * This is what createConnection() returns. It has all normal Kysely methods
 * plus batchInsert, batchUpdate, and batchUpsert.
 *
 * All batch operations are automatically atomic - wrapped in transactions
 * for all-or-nothing behavior.
 */
export type BatchKysely<DB> = Kysely<DB> & BatchMethods<DB>;

/**
 * Transaction with batch operation support.
 *
 * Returned from db.transaction().execute(). Has all normal Transaction methods
 * plus batch operations. Batch operations within a transaction use the
 * existing transaction (no nesting).
 */
export type BatchTransaction<DB> = Transaction<DB> & BatchMethods<DB>;

/**
 * Checks if the executor is already inside a transaction.
 *
 * @param executor - Kysely instance or transaction
 * @returns True if executor is a Transaction
 *
 * @internal
 */
export function isTransaction<DB>(
  executor: Kysely<DB> | Transaction<DB>,
): executor is Transaction<DB> {
  // Transaction instances don't have a .transaction() method
  // Kysely instances do
  return !('transaction' in executor && typeof executor.transaction === 'function');
}

/**
 * Executes an operation within a transaction, automatically creating one if needed.
 *
 * - If executor is already a Transaction, executes directly (no nesting)
 * - If executor is a Kysely instance, wraps in a new transaction
 *
 * This ensures all batch operations are atomic by default.
 *
 * @param executor - Kysely instance or existing transaction
 * @param operation - The operation to execute within transaction
 * @returns Result of the operation
 *
 * @internal
 */
export async function withAutoTransaction<DB, T>(
  executor: Kysely<DB> | Transaction<DB>,
  operation: (tx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  // Already in a transaction? Execute directly (don't double-wrap)
  if (isTransaction(executor)) {
    return operation(executor);
  }

  // Not in transaction? Wrap it automatically for atomicity
  return executor.transaction().execute(operation);
}

/**
 * Creates a batch-aware Kysely or Transaction instance.
 *
 * Uses JavaScript Proxy to add batch methods to the instance without
 * modifying the original Kysely/Transaction object. All normal Kysely
 * methods are forwarded transparently.
 *
 * @param kysely - Kysely instance or transaction to wrap
 * @param batchFunctions - The batch operation implementations
 * @returns Proxied instance with batch methods
 *
 * @internal
 */
export function createBatchAwareKysely<DB>(
  kysely: Kysely<DB> | Transaction<DB>,
  batchFunctions: {
    batchInsert: <TB extends keyof DB & string>(
      executor: Kysely<DB> | Transaction<DB>,
      table: TB,
      values: readonly Insertable<DB[TB]>[],
    ) => Promise<BatchResult>;
    batchUpdate: <TB extends keyof DB & string, K extends keyof DB[TB] & string>(
      executor: Kysely<DB> | Transaction<DB>,
      table: TB,
      values: readonly Updateable<DB[TB]>[],
      options: { key: K | readonly K[] },
    ) => Promise<BatchResult>;
    batchUpsert: <TB extends keyof DB & string, K extends keyof DB[TB] & string>(
      executor: Kysely<DB> | Transaction<DB>,
      table: TB,
      values: readonly Insertable<DB[TB]>[],
      options: { key: K | readonly K[] },
    ) => Promise<BatchResult>;
  },
): BatchKysely<DB> {
  const batchMethods: BatchMethods<DB> = {
    async batchInsert(table, values) {
      return batchFunctions.batchInsert(kysely, table, values);
    },

    async batchUpdate(table, values, options) {
      return batchFunctions.batchUpdate(kysely, table, values, options);
    },

    async batchUpsert(table, values, options) {
      return batchFunctions.batchUpsert(kysely, table, values, options);
    },
  };

  return new Proxy(kysely, {
    get(target, prop, receiver) {
      // Batch methods take priority
      if (prop in batchMethods) {
        return batchMethods[prop as keyof BatchMethods<DB>];
      }

      // Special handling for transaction() to wrap the returned Transaction
      if (prop === 'transaction' && typeof target[prop] === 'function') {
        return () => ({
          execute: async (callback: (tx: BatchTransaction<DB>) => Promise<any>) => {
            return target.transaction().execute(async (tx) => {
              const batchTx = createBatchAwareKysely(tx, batchFunctions) as BatchTransaction<DB>;
              return callback(batchTx);
            });
          },
        });
      }

      // Forward everything else to underlying Kysely/Transaction
      const value = Reflect.get(target, prop, receiver);

      // Bind methods to preserve 'this' context
      if (typeof value === 'function') {
        return value.bind(target);
      }

      return value;
    },
  }) as BatchKysely<DB>;
}
