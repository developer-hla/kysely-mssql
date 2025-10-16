import type { RequestError } from 'tedious';
import { describe, expect, it } from 'vitest';
import { createMockRequestError } from '../test-utils/factories.js';
import { DatabaseError } from './database-error.js';

describe('DatabaseError', () => {
  describe('constructor', () => {
    it('should create error with custom message', () => {
      const requestError = createMockRequestError(999, 'Original error message');
      const error = new DatabaseError('Custom error message', requestError);

      expect(error.message).toBe('Custom error message');
      expect(error.requestError).toBe(requestError);
    });

    it('should set name to DatabaseError', () => {
      const requestError = createMockRequestError(999, 'Test error');
      const error = new DatabaseError('Test message', requestError);

      expect(error.name).toBe('DatabaseError');
    });

    it('should capture stack trace', () => {
      const requestError = createMockRequestError(999, 'Test error');
      const error = new DatabaseError('Test message', requestError);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DatabaseError');
    });

    it('should maintain proper prototype chain', () => {
      const requestError = createMockRequestError(999, 'Test error');
      const error = new DatabaseError('Test message', requestError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should store the original RequestError', () => {
      const requestError = createMockRequestError(547, 'Foreign key violation', {
        lineNumber: 42,
        procName: 'sp_InsertUser',
      });
      const error = new DatabaseError('Test message', requestError);

      expect(error.requestError).toBe(requestError);
      expect(error.requestError.number).toBe(547);
      expect(error.requestError.message).toBe('Foreign key violation');
      expect(error.requestError.lineNumber).toBe(42);
      expect(error.requestError.procName).toBe('sp_InsertUser');
    });
  });

  describe('error serialization', () => {
    it('should define message property on requestError', () => {
      const requestError = createMockRequestError(999, 'Test error');
      const error = new DatabaseError('Test message', requestError);

      const descriptor = Object.getOwnPropertyDescriptor(error.requestError, 'message');
      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(false);
      expect(descriptor?.writable).toBe(true);
      expect(descriptor?.configurable).toBe(true);
    });

    it('should define stack property on requestError if present', () => {
      const requestError = createMockRequestError(999, 'Test error');
      const error = new DatabaseError('Test message', requestError);

      const descriptor = Object.getOwnPropertyDescriptor(error.requestError, 'stack');
      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(false);
    });
  });

  describe('subclass behavior', () => {
    it('should allow subclasses to maintain instanceof checks', () => {
      class CustomDatabaseError extends DatabaseError {
        constructor(error: RequestError) {
          super('Custom error', error);
        }
      }

      const requestError = createMockRequestError(999, 'Test error');
      const error = new CustomDatabaseError(requestError);

      expect(error).toBeInstanceOf(CustomDatabaseError);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
