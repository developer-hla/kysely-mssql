import type { RequestError } from 'tedious';
import { DatabaseError } from './database-error.js';

/**
 * Thrown when a transaction deadlock is detected.
 * SQL Server Error Number: 1205
 */
export class TransactionDeadlockError extends DatabaseError {
  constructor(error: RequestError) {
    super('Transaction deadlock', error);
  }
}

/**
 * Thrown when a snapshot isolation transaction is aborted due to conflict.
 * SQL Server Error Number: 3960
 */
export class TransactionConflictError extends DatabaseError {
  constructor(error: RequestError) {
    super('Transaction conflict', error);
  }
}
