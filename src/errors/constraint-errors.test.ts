import { describe, expect, it } from 'vitest';
import { createMockRequestError } from '../test-utils/factories.js';
import {
  DataTooLongError,
  DuplicateKeyError,
  ForeignKeyError,
  InvalidDataTypeError,
  RequiredFieldError,
} from './constraint-errors.js';
import { DatabaseError } from './database-error.js';

describe('DuplicateKeyError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(2601, 'Duplicate key violation');
    const error = new DuplicateKeyError(requestError);

    expect(error.message).toBe('Duplicate entry found');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(2601, 'Duplicate key violation');
    const error = new DuplicateKeyError(requestError);

    expect(error).toBeInstanceOf(DuplicateKeyError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should preserve requestError properties', () => {
    const requestError = createMockRequestError(2627, 'Duplicate key in unique index', {
      lineNumber: 15,
      procName: 'sp_CreateUser',
    });
    const error = new DuplicateKeyError(requestError);

    expect(error.requestError.number).toBe(2627);
    expect(error.requestError.lineNumber).toBe(15);
    expect(error.requestError.procName).toBe('sp_CreateUser');
  });
});

describe('ForeignKeyError', () => {
  it('should create error with INSERT/UPDATE message when not DELETE', () => {
    const requestError = createMockRequestError(
      547,
      'INSERT statement conflicted with FOREIGN KEY constraint',
    );
    const error = new ForeignKeyError(requestError);

    expect(error.message).toBe('Referenced record does not exist');
    expect(error.requestError).toBe(requestError);
  });

  it('should create error with DELETE message when DELETE operation', () => {
    const requestError = createMockRequestError(
      547,
      'DELETE statement conflicted with FOREIGN KEY constraint',
    );
    const error = new ForeignKeyError(requestError);

    expect(error.message).toBe('Cannot delete record. It is referenced by another record.');
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(547, 'Foreign key violation');
    const error = new ForeignKeyError(requestError);

    expect(error).toBeInstanceOf(ForeignKeyError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should only detect uppercase DELETE', () => {
    const requestErrorUppercase = createMockRequestError(
      547,
      'The DELETE statement conflicted with foreign key',
    );
    const errorUppercase = new ForeignKeyError(requestErrorUppercase);
    expect(errorUppercase.message).toBe(
      'Cannot delete record. It is referenced by another record.',
    );

    const requestErrorLowercase = createMockRequestError(
      547,
      'The delete statement conflicted with foreign key',
    );
    const errorLowercase = new ForeignKeyError(requestErrorLowercase);
    expect(errorLowercase.message).toBe('Referenced record does not exist');
  });
});

describe('DataTooLongError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(8152, 'String or binary data would be truncated');
    const error = new DataTooLongError(requestError);

    expect(error.message).toBe('Data too long for column');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(8152, 'Data truncation');
    const error = new DataTooLongError(requestError);

    expect(error).toBeInstanceOf(DataTooLongError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('RequiredFieldError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(515, 'Cannot insert the value NULL');
    const error = new RequiredFieldError(requestError);

    expect(error.message).toBe('Required field missing');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(515, 'NULL value not allowed');
    const error = new RequiredFieldError(requestError);

    expect(error).toBeInstanceOf(RequiredFieldError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('InvalidDataTypeError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(245, 'Conversion failed');
    const error = new InvalidDataTypeError(requestError);

    expect(error.message).toBe('Invalid data type');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(245, 'Type conversion error');
    const error = new InvalidDataTypeError(requestError);

    expect(error).toBeInstanceOf(InvalidDataTypeError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });
});
