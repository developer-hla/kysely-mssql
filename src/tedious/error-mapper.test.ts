import { describe, expect, it } from 'vitest';
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
import { createMockRequestError, SQL_SERVER_ERROR_NUMBERS } from '../test-utils/index.js';
import { mapDatabaseError } from './error-mapper.js';

describe('mapDatabaseError', () => {
  describe('constraint violation errors', () => {
    it('should map error 547 to ForeignKeyError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.FOREIGN_KEY_VIOLATION,
        'Foreign key violation',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(ForeignKeyError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 2601 to DuplicateKeyError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.DUPLICATE_KEY_INDEX,
        'Duplicate key on unique index',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DuplicateKeyError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 2627 to DuplicateKeyError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.DUPLICATE_KEY_CONSTRAINT,
        'Duplicate key on unique constraint',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DuplicateKeyError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 8152 to DataTooLongError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.STRING_TRUNCATION,
        'String data would be truncated',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DataTooLongError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 515 to RequiredFieldError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.NULL_VIOLATION,
        'Cannot insert NULL',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(RequiredFieldError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 245 to InvalidDataTypeError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.CONVERSION_FAILED,
        'Conversion failed',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(InvalidDataTypeError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 2628 to InvalidDataTypeError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.DATA_TRUNCATED,
        'Data truncated in table',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(InvalidDataTypeError);
      expect(result).toBeInstanceOf(DatabaseError);
    });
  });

  describe('transaction errors', () => {
    it('should map error 1205 to TransactionDeadlockError', () => {
      const error = createMockRequestError(SQL_SERVER_ERROR_NUMBERS.DEADLOCK, 'Deadlock victim');

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(TransactionDeadlockError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 3960 to TransactionConflictError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.SNAPSHOT_CONFLICT,
        'Snapshot isolation conflict',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(TransactionConflictError);
      expect(result).toBeInstanceOf(DatabaseError);
    });
  });

  describe('connection errors', () => {
    it('should map error 4060 to DatabaseConnectionError', () => {
      const error = createMockRequestError(
        SQL_SERVER_ERROR_NUMBERS.CANNOT_OPEN_DATABASE,
        'Cannot open database',
      );

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DatabaseConnectionError);
      expect(result).toBeInstanceOf(DatabaseError);
    });

    it('should map error 18456 to DatabaseConnectionError', () => {
      const error = createMockRequestError(SQL_SERVER_ERROR_NUMBERS.LOGIN_FAILED, 'Login failed');

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DatabaseConnectionError);
      expect(result).toBeInstanceOf(DatabaseError);
    });
  });

  describe('unknown errors', () => {
    it('should map unknown error number to DatabaseError', () => {
      const error = createMockRequestError(SQL_SERVER_ERROR_NUMBERS.UNKNOWN_ERROR, 'Unknown error');

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result).not.toBeInstanceOf(DuplicateKeyError);
      expect(result).not.toBeInstanceOf(ForeignKeyError);
    });

    it('should return original error if not RequestError', () => {
      const error = new Error('Regular error');

      const result = mapDatabaseError(error);

      expect(result).toBe(error);
      expect(result).not.toBeInstanceOf(DatabaseError);
    });
  });

  describe('error properties', () => {
    it('should preserve requestError details', () => {
      const mockError = createMockRequestError(547, 'Foreign key violation', {
        lineNumber: 42,
        procName: 'sp_InsertUser',
      });

      const result = mapDatabaseError(mockError) as ForeignKeyError;

      expect(result.requestError.number).toBe(547);
      expect(result.requestError.message).toBe('Foreign key violation');
      expect(result.requestError.lineNumber).toBe(42);
      expect(result.requestError.procName).toBe('sp_InsertUser');
    });

    it('should handle RequestError without error number', () => {
      const error = createMockRequestError(0, 'No error number');

      const result = mapDatabaseError(error);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Database error occurred');
    });
  });
});
