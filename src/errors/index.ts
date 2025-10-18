/**
 * Database error classes for typed error handling.
 *
 * These classes map SQL Server error numbers to TypeScript exceptions,
 * making it easy to handle specific database errors in your application.
 *
 * @example
 * ```typescript
 * import { DuplicateKeyError, ForeignKeyError } from '@dev-hla/kysely-mssql';
 *
 * try {
 *   await db.insertInto('users').values({...}).execute();
 * } catch (error) {
 *   if (error instanceof DuplicateKeyError) {
 *     console.log('User already exists');
 *   } else if (error instanceof ForeignKeyError) {
 *     console.log('Invalid foreign key');
 *   }
 * }
 * ```
 */

export { DatabaseConnectionError } from './connection-errors.js';
export {
  DataTooLongError,
  DuplicateKeyError,
  ForeignKeyError,
  InvalidDataTypeError,
  RequiredFieldError,
} from './constraint-errors.js';
export { DatabaseError } from './database-error.js';
export {
  TransactionConflictError,
  TransactionDeadlockError,
} from './transaction-errors.js';
