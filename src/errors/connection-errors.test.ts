import { describe, expect, it } from 'vitest';
import { createMockRequestError } from '../test-utils/factories.js';
import { DatabaseConnectionError } from './connection-errors.js';
import { DatabaseError } from './database-error.js';

describe('DatabaseConnectionError', () => {
  it('should create error with correct message for cannot open database', () => {
    const requestError = createMockRequestError(4060, 'Cannot open database "TestDB"');
    const error = new DatabaseConnectionError(requestError);

    expect(error.message).toBe('Database connection error');
    expect(error.requestError).toBe(requestError);
  });

  it('should create error with correct message for login failed', () => {
    const requestError = createMockRequestError(18456, 'Login failed for user "testuser"');
    const error = new DatabaseConnectionError(requestError);

    expect(error.message).toBe('Database connection error');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(4060, 'Connection error');
    const error = new DatabaseConnectionError(requestError);

    expect(error).toBeInstanceOf(DatabaseConnectionError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should preserve requestError properties', () => {
    const requestError = createMockRequestError(18456, 'Login failed', {
      lineNumber: 1,
      procName: undefined,
    });
    const error = new DatabaseConnectionError(requestError);

    expect(error.requestError.number).toBe(18456);
    expect(error.requestError.lineNumber).toBe(1);
    expect(error.requestError.message).toBe('Login failed');
  });
});
