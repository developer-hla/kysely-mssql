import { Request as TediousRequest } from 'tedious';
import { mapDatabaseError } from './error-mapper.js';

/**
 * Callback signature for Tedious Request completion.
 */
type CompletionCallback = (
  /**
   * If an error occurred, an error object.
   */
  error: Error | null | undefined,
  /**
   * The number of rows emitted as result of executing the SQL statement.
   */
  rowCount?: number,
  /**
   * Rows as a result of executing the SQL statement.
   * Will only be available if ConnectionOptions.rowCollectionOnRequestCompletion is true.
   */
  rows?: any,
) => void;

/**
 * Custom Request class that extends Tedious Request with automatic error mapping.
 *
 * This class intercepts all database errors and maps SQL Server error numbers
 * to typed error classes, enabling semantic error handling in application code.
 *
 * @example
 * ```typescript
 * // This happens automatically when using createConnection()
 * // Errors are transformed from generic RequestError to specific types:
 * // - Error 2627 → DuplicateKeyError
 * // - Error 547 → ForeignKeyError
 * // - Error 1205 → TransactionDeadlockError
 * // etc.
 * ```
 */
export class Request extends TediousRequest {
  constructor(
    sqlTextOrProcedure: string | undefined,
    callback: CompletionCallback,
    options?: Record<string, unknown>,
  ) {
    // Wrap the callback to map database errors
    const withDatabaseErrorCallback: CompletionCallback = (error, rowCount, rows) => {
      // Map the error to a more specific error type
      if (error) {
        error = mapDatabaseError(error);
      }

      callback(error, rowCount, rows);
    };

    super(sqlTextOrProcedure, withDatabaseErrorCallback, options);
  }
}
