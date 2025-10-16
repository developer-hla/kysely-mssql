import type { Kysely, Transaction } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { wrapInTransaction } from './transaction.js';

describe('wrapInTransaction', () => {
  describe('with existing transaction', () => {
    it('should reuse existing transaction', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      const result = await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

      expect(mockCallback).toHaveBeenCalledWith(mockTransaction);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should not create a new transaction when one is provided', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransaction = {} as Transaction<any>;
      const mockTransactionBuilder = {
        execute: vi.fn(),
      };
      const mockDb = {
        transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
      } as unknown as Kysely<any>;

      await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return the callback result when using existing transaction', async () => {
      const expectedResult = { id: 123, name: 'Test' };
      const mockCallback = vi.fn().mockResolvedValue(expectedResult);
      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      const result = await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from callback with existing transaction', async () => {
      const testError = new Error('Callback failed');
      const mockCallback = vi.fn().mockRejectedValue(testError);
      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      await expect(
        wrapInTransaction({
          db: mockDb,
          callback: mockCallback,
          previousTransaction: mockTransaction,
        }),
      ).rejects.toThrow('Callback failed');
    });
  });

  describe('without existing transaction', () => {
    it('should create a new transaction when none is provided', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransactionBuilder = {
        execute: vi.fn().mockImplementation((cb) => cb({})),
      };
      const mockDb = {
        transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
      } as unknown as Kysely<any>;

      await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionBuilder.execute).toHaveBeenCalledWith(mockCallback);
    });

    it('should return the callback result when creating new transaction', async () => {
      const expectedResult = { id: 456, name: 'New Record' };
      const mockCallback = vi.fn().mockResolvedValue(expectedResult);
      const mockTransactionBuilder = {
        execute: vi.fn().mockImplementation((cb) => cb({}).then(() => expectedResult)),
      };
      const mockDb = {
        transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
      } as unknown as Kysely<any>;

      const result = await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
      });

      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from callback with new transaction', async () => {
      const testError = new Error('Transaction failed');
      const mockCallback = vi.fn().mockRejectedValue(testError);
      const mockTransactionBuilder = {
        execute: vi.fn().mockImplementation((cb) => cb({}).catch((err) => Promise.reject(err))),
      };
      const mockDb = {
        transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
      } as unknown as Kysely<any>;

      await expect(
        wrapInTransaction({
          db: mockDb,
          callback: mockCallback,
        }),
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle undefined previousTransaction explicitly', async () => {
      const mockCallback = vi.fn().mockResolvedValue('result');
      const mockTransactionBuilder = {
        execute: vi.fn().mockImplementation((cb) => cb({})),
      };
      const mockDb = {
        transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
      } as unknown as Kysely<any>;

      await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: undefined,
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('callback execution', () => {
    it('should pass transaction to callback', async () => {
      const mockTransaction = { id: 'tx-123' } as any;
      let capturedTransaction: any;

      const mockCallback = vi.fn().mockImplementation((tx) => {
        capturedTransaction = tx;
        return Promise.resolve('result');
      });

      const mockDb = {} as Kysely<any>;

      await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

      expect(capturedTransaction).toBe(mockTransaction);
    });

    it('should handle async callback', async () => {
      const mockCallback = vi.fn().mockImplementation(async (_tx) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      const result = await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

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
      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      const result = await wrapInTransaction({
        db: mockDb,
        callback: mockCallback,
        previousTransaction: mockTransaction,
      });

      expect(result).toEqual(complexResult);
      expect(result.user.id).toBe(1);
      expect(result.metadata.created).toBeInstanceOf(Date);
    });
  });

  describe('composability', () => {
    it('should enable nested transaction calls', async () => {
      const innerCallback = vi.fn().mockResolvedValue('inner-result');
      const mockTransaction = {} as Transaction<any>;
      const mockDb = {} as Kysely<any>;

      const outerCallback = vi.fn().mockImplementation(async (tx) => {
        const innerResult = await wrapInTransaction({
          db: mockDb,
          callback: innerCallback,
          previousTransaction: tx,
        });
        return `outer-${innerResult}`;
      });

      const result = await wrapInTransaction({
        db: mockDb,
        callback: outerCallback,
        previousTransaction: mockTransaction,
      });

      expect(result).toBe('outer-inner-result');
      expect(outerCallback).toHaveBeenCalledWith(mockTransaction);
      expect(innerCallback).toHaveBeenCalledWith(mockTransaction);
    });
  });
});
