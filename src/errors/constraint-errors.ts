import type { RequestError } from 'tedious';
import { DatabaseError } from './database-error.js';

/**
 * Thrown when attempting to insert a duplicate key.
 * SQL Server Error Numbers: 2601, 2627
 */
export class DuplicateKeyError extends DatabaseError {
  constructor(error: RequestError) {
    super('Duplicate entry found', error);
  }
}

/**
 * Thrown when a foreign key constraint is violated.
 * SQL Server Error Number: 547
 */
export class ForeignKeyError extends DatabaseError {
  constructor(error: RequestError) {
    const isDelete = error.message.includes('DELETE');
    const message = isDelete
      ? 'Cannot delete record. It is referenced by another record.'
      : 'Referenced record does not exist';
    super(message, error);
  }
}

/**
 * Thrown when data exceeds column length.
 * SQL Server Error Numbers: 8152, 2628
 */
export class DataTooLongError extends DatabaseError {
  constructor(error: RequestError) {
    super('Data too long for column', error);
  }
}

/**
 * Thrown when attempting to insert NULL into a NOT NULL column.
 * SQL Server Error Number: 515
 */
export class RequiredFieldError extends DatabaseError {
  constructor(error: RequestError) {
    super('Required field missing', error);
  }
}

/**
 * Thrown when a data type conversion fails.
 * SQL Server Error Number: 245
 */
export class InvalidDataTypeError extends DatabaseError {
  constructor(error: RequestError) {
    super('Invalid data type', error);
  }
}
