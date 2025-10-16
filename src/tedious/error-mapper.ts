import { RequestError } from 'tedious';
import {
  DatabaseConnectionError,
  DatabaseError,
  DataTooLongError,
  DuplicateKeyError,
  ForeignKeyError,
  InvalidDataTypeError,
  RequiredFieldError,
  TransactionConflictError,
  TransactionDeadlockError,
} from '../errors/index.js';

/**
 * Maps SQL Server error numbers to typed error classes.
 *
 * This function translates generic RequestError objects into specific,
 * typed error classes based on SQL Server error numbers, making error
 * handling in application code more semantic and type-safe.
 *
 * @param error - The error to map
 * @returns A typed error if the error number is recognized, otherwise the original error
 *
 * @example
 * ```typescript
 * try {
 *   // ... database operation
 * } catch (error) {
 *   const mappedError = mapDatabaseError(error);
 *   if (mappedError instanceof DuplicateKeyError) {
 *     // Handle duplicate key specifically
 *   }
 * }
 * ```
 */
export function mapDatabaseError(error: Error): Error {
  if (!(error instanceof RequestError)) {
    return error;
  }

  // SQL Server error numbers
  const errorNumber = error.number ?? 0;

  switch (errorNumber) {
    // Constraint Violations
    case 547: // Foreign key violation
      return new ForeignKeyError(error);

    case 2601: // Cannot insert duplicate key row (unique index)
    case 2627: // Cannot insert duplicate key row (unique constraint)
      return new DuplicateKeyError(error);

    case 8152: // String or binary data would be truncated
      return new DataTooLongError(error);

    case 515: // Cannot insert NULL
      return new RequiredFieldError(error);

    case 245: // Conversion failed
    case 2628: // String or binary data would be truncated in table
      return new InvalidDataTypeError(error);

    // Transaction Errors
    case 1205: // Deadlock
      return new TransactionDeadlockError(error);

    case 3960: // Snapshot isolation transaction aborted
      return new TransactionConflictError(error);

    // Connection/State Errors
    case 4060: // Cannot open database
    case 18456: // Login failed
      return new DatabaseConnectionError(error);

    default:
      return new DatabaseError('Database error occurred', error);
  }
}
