import type { RequestError } from 'tedious';
import { DatabaseError } from './database-error.js';

/**
 * Thrown when a database connection error occurs.
 * SQL Server Error Numbers: 4060 (cannot open database), 18456 (login failed)
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(error: RequestError) {
    super('Database connection error', error);
  }
}
