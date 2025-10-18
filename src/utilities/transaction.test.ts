import { describe, expect, it, vi } from 'vitest';
import { createMockKysely, createMockTransaction } from '../test-utils/index.js';
import { wrapInTransaction } from './transaction.js';

describe('wrapInTransaction', () => {
  describe('with existing transaction', () => {
    it('should reuse existing transaction', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransaction = createMockTransaction();

      const result = await wrapInTransaction(mockTransaction, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockTransaction);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should not create a new transaction when one is provided', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransaction = createMockTransaction();
      const mockDb = createMockKysely();

      // Mock the isTransaction check
      mockTransaction.isTransaction = true;

      await wrapInTransaction(mockTransaction, mockCallback);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return the callback result when using existing transaction', async () => {
      const expectedResult = { id: 123, name: 'Test' };
      const mockCallback = vi.fn().mockResolvedValue(expectedResult);
      const mockTransaction = createMockTransaction();

      const result = await wrapInTransaction(mockTransaction, mockCallback);

      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from callback with existing transaction', async () => {
      const testError = new Error('Callback failed');
      const mockCallback = vi.fn().mockRejectedValue(testError);
      const mockTransaction = createMockTransaction();

      await expect(wrapInTransaction(mockTransaction, mockCallback)).rejects.toThrow(
        'Callback failed',
      );
    });
  });

  describe('without existing transaction', () => {
    it('should create a new transaction when db is provided', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockDb = createMockKysely();

      await wrapInTransaction(mockDb, mockCallback);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should return the callback result when creating new transaction', async () => {
      const expectedResult = { id: 456, name: 'New Record' };
      const mockCallback = vi.fn().mockResolvedValue(expectedResult);
      const mockDb = createMockKysely();

      const result = await wrapInTransaction(mockDb, mockCallback);

      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from callback with new transaction', async () => {
      const testError = new Error('Transaction failed');
      const mockCallback = vi.fn().mockRejectedValue(testError);
      const mockDb = createMockKysely();

      await expect(wrapInTransaction(mockDb, mockCallback)).rejects.toThrow('Transaction failed');
    });
  });

  describe('callback execution', () => {
    it('should pass transaction to callback', async () => {
      const mockTransaction = createMockTransaction();
      let capturedTransaction: ReturnType<typeof createMockTransaction> | undefined;

      const mockCallback = vi.fn().mockImplementation((tx) => {
        capturedTransaction = tx;
        return Promise.resolve('result');
      });

      await wrapInTransaction(mockTransaction, mockCallback);

      expect(capturedTransaction).toBe(mockTransaction);
    });

    it('should handle async callback', async () => {
      const mockCallback = vi.fn().mockImplementation(async (_tx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      const mockTransaction = createMockTransaction();

      const result = await wrapInTransaction(mockTransaction, mockCallback);

      expect(result).toBe('async-result');
    });

    it('should handle callback returning complex types', async () => {
      interface ComplexResult {
        user: { id: number; name: string };
        metadata: { created: Date };
      }

      const complexResult: ComplexResult = {
        user: { id: 1, name: 'Test User' },
        metadata: { created: new Date('2025-01-01') },
      };

      const mockCallback = vi.fn().mockResolvedValue(complexResult);
      const mockTransaction = createMockTransaction();

      const result: ComplexResult = await wrapInTransaction(mockTransaction, mockCallback);

      expect(result).toEqual(complexResult);
      expect(result.user.id).toBe(1);
      expect(result.metadata.created).toBeInstanceOf(Date);
    });
  });

  describe('composability', () => {
    it('should enable nested transaction calls', async () => {
      const innerCallback = vi.fn().mockResolvedValue('inner-result');
      const mockTransaction = createMockTransaction();

      const outerCallback = vi.fn().mockImplementation(async (tx) => {
        const innerResult = await wrapInTransaction(tx, innerCallback);
        return `outer-${innerResult}`;
      });

      const result = await wrapInTransaction(mockTransaction, outerCallback);

      expect(result).toBe('outer-inner-result');
      expect(outerCallback).toHaveBeenCalledWith(mockTransaction);
      expect(innerCallback).toHaveBeenCalledWith(mockTransaction);
    });
  });
});
