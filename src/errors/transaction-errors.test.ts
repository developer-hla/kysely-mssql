import { describe, expect, it } from 'vitest';
import { createMockRequestError } from '../test-utils/factories.js';
import { DatabaseError } from './database-error.js';
import { TransactionConflictError, TransactionDeadlockError } from './transaction-errors.js';

describe('TransactionDeadlockError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(
      1205,
      'Transaction was deadlocked on lock resources',
    );
    const error = new TransactionDeadlockError(requestError);

    expect(error.message).toBe('Transaction deadlock');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(1205, 'Deadlock detected');
    const error = new TransactionDeadlockError(requestError);

    expect(error).toBeInstanceOf(TransactionDeadlockError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should preserve requestError properties', () => {
    const requestError = createMockRequestError(1205, 'Deadlock', {
      lineNumber: 25,
      procName: 'sp_UpdateInventory',
    });
    const error = new TransactionDeadlockError(requestError);

    expect(error.requestError.number).toBe(1205);
    expect(error.requestError.lineNumber).toBe(25);
    expect(error.requestError.procName).toBe('sp_UpdateInventory');
  });
});

describe('TransactionConflictError', () => {
  it('should create error with correct message', () => {
    const requestError = createMockRequestError(
      3960,
      'Snapshot isolation transaction aborted due to update conflict',
    );
    const error = new TransactionConflictError(requestError);

    expect(error.message).toBe('Transaction conflict');
    expect(error.requestError).toBe(requestError);
  });

  it('should be instance of DatabaseError', () => {
    const requestError = createMockRequestError(3960, 'Snapshot conflict');
    const error = new TransactionConflictError(requestError);

    expect(error).toBeInstanceOf(TransactionConflictError);
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should preserve requestError properties', () => {
    const requestError = createMockRequestError(3960, 'Transaction conflict', {
      lineNumber: 50,
      procName: 'sp_ProcessOrder',
    });
    const error = new TransactionConflictError(requestError);

    expect(error.requestError.number).toBe(3960);
    expect(error.requestError.lineNumber).toBe(50);
    expect(error.requestError.procName).toBe('sp_ProcessOrder');
  });
});
