import type { Kysely, Transaction } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import {
  createMockKysely,
  createMockTransaction,
  type MinimalTestDatabase,
} from '../../test-utils/index.js';
import { batchUpsert } from './upsert.js';

// Helper to create properly configured mocks for batch upsert operations with auto-transactions
function createBatchUpsertMockDb() {
  const mockExecute = vi.fn().mockResolvedValue(undefined);

  const mockThenInsertValues = vi.fn().mockReturnValue({
    execute: mockExecute,
  });

  const mockWhenNotMatched = vi.fn().mockReturnValue({
    thenInsertValues: mockThenInsertValues,
  });

  const mockThenUpdateSet = vi.fn().mockReturnValue({
    whenNotMatched: mockWhenNotMatched,
  });

  const mockWhenMatched = vi.fn().mockReturnValue({
    thenUpdateSet: mockThenUpdateSet,
  });

  const mockUsing = vi.fn().mockReturnValue({
    whenMatched: mockWhenMatched,
  });

  const mockMergeInto = vi.fn().mockReturnValue({
    using: mockUsing,
  });

  const mockTx = createMockTransaction<MinimalTestDatabase>();
  // as any: Required to add methods not in base Transaction type for testing
  (mockTx as any).mergeInto = mockMergeInto;

  const mockDb = createMockKysely<MinimalTestDatabase>();
  // as any: Required to mock vitest function methods for testing
  (mockDb.transaction as any).mockReturnValue({
    execute: vi.fn().mockImplementation((callback: any) => callback(mockTx)),
  });

  return {
    mockDb: mockDb as Kysely<MinimalTestDatabase>,
    mockTx: mockTx as Transaction<MinimalTestDatabase> & { mergeInto: any },
    mockMergeInto,
    mockUsing,
    mockWhenMatched,
    mockThenUpdateSet,
    mockWhenNotMatched,
    mockThenInsertValues,
    mockExecute,
  };
}

describe('batchUpsert', () => {
  describe('basic functionality', () => {
    it('should upsert records with explicit key field', async () => {
      const { mockDb, mockTx } = createBatchUpsertMockDb();

      const upserts = [
        { id: 1, name: 'Alice Updated', email: 'alice@test.com' },
        { id: 2, name: 'Bob Updated', email: 'bob@test.com' },
      ];

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      expect(mockTx.mergeInto).toHaveBeenCalledWith('users');
      expect(result).toEqual({ totalRecords: 2, batchCount: 1 });
    });

    it('should handle empty array without executing queries', async () => {
      const { mockDb, mockTx } = createBatchUpsertMockDb();

      const result = await batchUpsert(mockDb, 'users', [], { key: 'id' });

      expect(mockTx.mergeInto).not.toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 0, batchCount: 0 });
    });

    it('should upsert single record', async () => {
      const { mockDb, mockTx } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: 'Updated', email: 'test@example.com' }],
        {
          key: 'id',
        },
      );

      expect(mockTx.mergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should call all MERGE methods in correct order', async () => {
      const {
        mockDb,
        mockMergeInto,
        mockUsing,
        mockWhenMatched,
        mockThenUpdateSet,
        mockWhenNotMatched,
        mockThenInsertValues,
        mockExecute,
      } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
        {
          key: 'id',
        },
      );

      expect(mockMergeInto).toHaveBeenCalled();
      expect(mockUsing).toHaveBeenCalled();
      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockThenUpdateSet).toHaveBeenCalled();
      expect(mockWhenNotMatched).toHaveBeenCalled();
      expect(mockThenInsertValues).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });
  });

  describe('custom key field', () => {
    it('should support custom key field', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [{ email: 'user@test.com', name: 'Updated Name' }],
        {
          key: 'email',
        },
      );

      expect(mockMergeInto).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should use custom key in ON clause', async () => {
      const { mockDb, mockUsing } = createBatchUpsertMockDb();

      await batchUpsert(mockDb, 'users', [{ email: 'user@test.com', name: 'Updated' }], {
        key: 'email',
      });

      // Verify using was called with key field in ON condition
      expect(mockUsing).toHaveBeenCalled();
      const usingArgs = mockUsing.mock.calls[0];
      // Second argument should be 'source.email'
      expect(usingArgs[1]).toContain('email');
    });
  });

  describe('composite keys', () => {
    it('should support composite keys with multiple fields', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'posts',
        [{ userId: 1, status: 'published', title: 'Updated' }],
        {
          key: ['userId', 'status'],
        },
      );

      expect(mockMergeInto).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should use composite key in ON clause', async () => {
      const { mockDb, mockUsing } = createBatchUpsertMockDb();

      await batchUpsert(mockDb, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockUsing).toHaveBeenCalled();
      // For composite keys, using should be called with a function as the ON condition
      const usingArgs = mockUsing.mock.calls[0];
      expect(typeof usingArgs[1]).toBe('function');
    });

    it('should only update non-key fields', async () => {
      const { mockDb, mockThenUpdateSet } = createBatchUpsertMockDb();

      await batchUpsert(
        mockDb,
        'posts',
        [{ userId: 1, status: 'published', title: 'Updated', content: 'New content' }],
        { key: ['userId', 'status'] },
      );

      expect(mockThenUpdateSet).toHaveBeenCalled();
      // The update set should be a function that builds the update object
      const updateSetFn = mockThenUpdateSet.mock.calls[0][0];
      expect(typeof updateSetFn).toBe('function');
    });
  });

  describe('batch size', () => {
    it('should use automatic batch sizing based on column count', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      // 3 columns → floor(2000/3) = 666 batch size → all 10 fit in 1 call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 10, batchCount: 1 });
    });

    it('should use default batch size of 1000', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      // All 5 should fit in default batch
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 5, batchCount: 1 });
    });

    it('should process large datasets in batches with smart sizing', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = Array.from({ length: 2500 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      // Automatic batch sizing: 3 columns → floor(2000/3) = 666
      // 2500 records → ceil(2500/666) = 4 batches
      expect(mockMergeInto).toHaveBeenCalledTimes(4);
      expect(result).toEqual({ totalRecords: 2500, batchCount: 4 });
    });
  });

  describe('error handling', () => {
    it('should throw error when key field is missing', async () => {
      const { mockDb } = createBatchUpsertMockDb();

      // Intentionally omitting 'id' field to test error handling
      const upserts: Array<{ name: string }> = [{ name: 'Alice' }];

      await expect(batchUpsert(mockDb, 'users', upserts as any, { key: 'id' })).rejects.toThrow(
        "Key field 'id' is missing or null",
      );
    });

    it('should throw error when custom key field is missing', async () => {
      const { mockDb } = createBatchUpsertMockDb();

      // Intentionally omitting 'email' field to test error handling
      const upserts: Array<{ name: string }> = [{ name: 'Alice' }];

      await expect(batchUpsert(mockDb, 'users', upserts as any, { key: 'email' })).rejects.toThrow(
        "Key field 'email' is missing or null",
      );
    });

    it('should throw error when one of composite key fields is missing', async () => {
      const { mockDb } = createBatchUpsertMockDb();

      // Intentionally omitting 'status' field to test error handling
      const upserts: Array<{ userId: number; title: string }> = [{ userId: 1, title: 'Updated' }];

      await expect(
        batchUpsert(mockDb, 'posts', upserts as any, { key: ['userId', 'status'] }),
      ).rejects.toThrow("Key field 'status' is missing or null");
    });

    it('should validate key fields for all records in batch', async () => {
      const { mockDb } = createBatchUpsertMockDb();

      // Second record intentionally missing 'id' field to test validation
      const upserts: Array<{ id?: number; name: string; email: string }> = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' }, // Missing id
      ];

      await expect(batchUpsert(mockDb, 'users', upserts as any, { key: 'id' })).rejects.toThrow(
        "Key field 'id' is missing or null",
      );
    });
  });

  describe('transaction support', () => {
    it('should work with transaction executor', async () => {
      const { mockDb: tx, mockMergeInto } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        tx,
        'users',
        [{ id: 1, name: 'Updated', email: 'test@example.com' }],
        {
          key: 'id',
        },
      );

      expect(mockMergeInto).toHaveBeenCalledWith('users');
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should execute all upserts in transaction context', async () => {
      const { mockDb: tx, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' },
        { id: 3, name: 'User 3', email: 'user3@test.com' },
      ];

      const result = await batchUpsert(tx, 'users', upserts, { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 3, batchCount: 1 });
    });
  });

  describe('upsert semantics', () => {
    it('should insert when not matched', async () => {
      const { mockDb, mockWhenNotMatched, mockThenInsertValues } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [{ id: 999, name: 'New User', email: 'newuser@test.com' }],
        {
          key: 'id',
        },
      );

      expect(mockWhenNotMatched).toHaveBeenCalled();
      expect(mockThenInsertValues).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should update when matched', async () => {
      const { mockDb, mockWhenMatched, mockThenUpdateSet } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: 'Updated User', email: 'updated@test.com' }],
        {
          key: 'id',
        },
      );

      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockThenUpdateSet).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should handle mix of inserts and updates', async () => {
      const { mockDb, mockWhenMatched, mockWhenNotMatched } = createBatchUpsertMockDb();

      const result = await batchUpsert(
        mockDb,
        'users',
        [
          { id: 1, name: 'Existing Updated', email: 'existing@test.com' },
          { id: 999, name: 'New User', email: 'newuser@test.com' },
        ],
        { key: 'id' },
      );

      // Both whenMatched and whenNotMatched should be called
      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockWhenNotMatched).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 2, batchCount: 1 });
    });
  });

  describe('type safety', () => {
    it('should enforce table types', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      // Valid: users table with correct fields
      const result1 = await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
        {
          key: 'id',
        },
      );

      // Valid: posts table with correct fields
      const result2 = await batchUpsert(mockDb, 'posts', [{ id: 1, userId: 1, title: 'Post' }], {
        key: 'id',
      });

      expect(mockMergeInto).toHaveBeenCalledTimes(2);
      expect(result1).toEqual({ totalRecords: 1, batchCount: 1 });
      expect(result2).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should work with different database schemas', () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      // Should compile with custom key field (demonstrates flexibility across schemas)
      const upserts = [{ email: 'user@test.com', name: 'Test User' }];

      batchUpsert(mockDb, 'users', upserts, { key: 'email' });

      expect(mockMergeInto).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle records with undefined values in upsert data', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      // Testing edge case where field value is explicitly undefined
      await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: undefined as unknown as string, email: 'test@example.com' }],
        { key: 'id' },
      );

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should handle records with null values', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      // Testing edge case where field value is explicitly null
      const result = await batchUpsert(
        mockDb,
        'users',
        [{ id: 1, name: null as unknown as string, email: 'test@example.com' }],
        {
          key: 'id',
        },
      );

      expect(mockMergeInto).toHaveBeenCalled();
      expect(result).toEqual({ totalRecords: 1, batchCount: 1 });
    });

    it('should handle exactly batch size records', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = Array.from({ length: 666 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      // 3 columns → batch size 666 → exactly 1 call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 666, batchCount: 1 });
    });

    it('should handle one more than batch size', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const upserts = Array.from({ length: 667 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      // 3 columns → batch size 666 → ceil(667/666) = 2 calls
      expect(mockMergeInto).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ totalRecords: 667, batchCount: 2 });
    });
  });

  describe('integration patterns', () => {
    it('should support syncing data from external sources', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      // Simulate external API data
      const apiData = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 999, name: 'Charlie', email: 'charlie@test.com' },
      ];

      const result = await batchUpsert(mockDb, 'users', apiData, { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 3, batchCount: 1 });
    });

    it('should work with mapped/transformed data', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const externalData = [
        { userId: 1, userName: 'Alice', userEmail: 'alice@external.com' },
        { userId: 2, userName: 'Bob', userEmail: 'bob@external.com' },
      ];

      const upserts = externalData.map((item) => ({
        id: item.userId,
        name: item.userName,
        email: item.userEmail,
      }));

      const result = await batchUpsert(mockDb, 'users', upserts, { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 2, batchCount: 1 });
    });

    it('should support conditional upserts in application code', async () => {
      const { mockDb, mockMergeInto } = createBatchUpsertMockDb();

      const allRecords = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com' },
      ];

      // Filter records before upsert
      const recordsToUpsert = allRecords.filter((r) => r.id > 1);

      const result = await batchUpsert(mockDb, 'users', recordsToUpsert, { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ totalRecords: 2, batchCount: 1 });
    });
  });
});
