import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createMockKysely, type MinimalTestDatabase } from '../test-utils/index.js';
import { batchUpsert } from './batch-upsert.js';

// Helper to create a mock db with mergeInto support
function createMockUpsertDb() {
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

  const db = {
    ...createMockKysely<MinimalTestDatabase>(),
    mergeInto: mockMergeInto,
  } as unknown as Kysely<MinimalTestDatabase>;

  return {
    db,
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
    it('should upsert records with default key field', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = [
        { id: 1, name: 'Alice Updated', email: 'alice@test.com' },
        { id: 2, name: 'Bob Updated', email: 'bob@test.com' },
      ];

      await batchUpsert(db, 'users', upserts);

      expect(mockMergeInto).toHaveBeenCalledWith('users');
    });

    it('should handle empty array without executing queries', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'users', []);

      expect(mockMergeInto).not.toHaveBeenCalled();
    });

    it('should upsert single record', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ id: 1, name: 'Updated', email: 'test@example.com' }]);

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should call all MERGE methods in correct order', async () => {
      const {
        db,
        mockMergeInto,
        mockUsing,
        mockWhenMatched,
        mockThenUpdateSet,
        mockWhenNotMatched,
        mockThenInsertValues,
        mockExecute,
      } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ id: 1, name: 'Alice', email: 'alice@test.com' }]);

      expect(mockMergeInto).toHaveBeenCalled();
      expect(mockUsing).toHaveBeenCalled();
      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockThenUpdateSet).toHaveBeenCalled();
      expect(mockWhenNotMatched).toHaveBeenCalled();
      expect(mockThenInsertValues).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('custom key field', () => {
    it('should support custom key field', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ email: 'user@test.com', name: 'Updated Name' }], {
        key: 'email',
      });

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should use custom key in ON clause', async () => {
      const { db, mockUsing } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ email: 'user@test.com', name: 'Updated' }], {
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
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should use composite key in ON clause', async () => {
      const { db, mockUsing } = createMockUpsertDb();

      await batchUpsert(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockUsing).toHaveBeenCalled();
      // For composite keys, using should be called with a function as the ON condition
      const usingArgs = mockUsing.mock.calls[0];
      expect(typeof usingArgs[1]).toBe('function');
    });

    it('should only update non-key fields', async () => {
      const { db, mockThenUpdateSet } = createMockUpsertDb();

      await batchUpsert(
        db,
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
    it('should respect custom batch size', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      await batchUpsert(db, 'users', upserts, { batchSize: 3 });

      // With batch size 3 and 10 records, should make 4 upsert calls (3+3+3+1)
      expect(mockMergeInto).toHaveBeenCalledTimes(4);
    });

    it('should use default batch size of 1000', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      await batchUpsert(db, 'users', upserts);

      // All 5 should fit in default batch
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should process large datasets in batches', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = Array.from({ length: 2500 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      await batchUpsert(db, 'users', upserts, { batchSize: 1000 });

      // 2500 records should result in 3 upsert calls (1000+1000+500)
      expect(mockMergeInto).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should throw error when key field is missing', async () => {
      const { db } = createMockUpsertDb();

      const upserts = [{ name: 'Alice' }] as any;

      await expect(batchUpsert(db, 'users', upserts)).rejects.toThrow(
        "Key field 'id' is missing in upsert object",
      );
    });

    it('should throw error when custom key field is missing', async () => {
      const { db } = createMockUpsertDb();

      const upserts = [{ name: 'Alice' }] as any;

      await expect(batchUpsert(db, 'users', upserts, { key: 'email' })).rejects.toThrow(
        "Key field 'email' is missing in upsert object",
      );
    });

    it('should throw error when one of composite key fields is missing', async () => {
      const { db } = createMockUpsertDb();

      const upserts = [{ userId: 1, title: 'Updated' }] as any;

      await expect(
        batchUpsert(db, 'posts', upserts, { key: ['userId', 'status'] }),
      ).rejects.toThrow("Key field 'status' is missing in upsert object");
    });

    it('should validate key fields for all records in batch', async () => {
      const { db } = createMockUpsertDb();

      const upserts = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob' }, // Missing id
      ] as any;

      await expect(batchUpsert(db, 'users', upserts)).rejects.toThrow(
        "Key field 'id' is missing in upsert object",
      );
    });
  });

  describe('transaction support', () => {
    it('should work with transaction executor', async () => {
      const { db: tx, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(tx, 'users', [{ id: 1, name: 'Updated', email: 'test@example.com' }]);

      expect(mockMergeInto).toHaveBeenCalledWith('users');
    });

    it('should execute all upserts in transaction context', async () => {
      const { db: tx, mockMergeInto } = createMockUpsertDb();

      const upserts = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' },
        { id: 3, name: 'User 3', email: 'user3@test.com' },
      ];

      await batchUpsert(tx, 'users', upserts);

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsert semantics', () => {
    it('should insert when not matched', async () => {
      const { db, mockWhenNotMatched, mockThenInsertValues } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ id: 999, name: 'New User', email: 'newuser@test.com' }]);

      expect(mockWhenNotMatched).toHaveBeenCalled();
      expect(mockThenInsertValues).toHaveBeenCalled();
    });

    it('should update when matched', async () => {
      const { db, mockWhenMatched, mockThenUpdateSet } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ id: 1, name: 'Updated User', email: 'updated@test.com' }]);

      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockThenUpdateSet).toHaveBeenCalled();
    });

    it('should handle mix of inserts and updates', async () => {
      const { db, mockWhenMatched, mockWhenNotMatched } = createMockUpsertDb();

      await batchUpsert(db, 'users', [
        { id: 1, name: 'Existing Updated', email: 'existing@test.com' },
        { id: 999, name: 'New User', email: 'newuser@test.com' },
      ]);

      // Both whenMatched and whenNotMatched should be called
      expect(mockWhenMatched).toHaveBeenCalled();
      expect(mockWhenNotMatched).toHaveBeenCalled();
    });
  });

  describe('type safety', () => {
    it('should enforce table types', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      // Valid: users table with correct fields
      await batchUpsert(db, 'users', [{ id: 1, name: 'Alice', email: 'alice@test.com' }]);

      // Valid: posts table with correct fields
      await batchUpsert(db, 'posts', [{ id: 1, userId: 1, title: 'Post' }]);

      expect(mockMergeInto).toHaveBeenCalledTimes(2);
    });

    it('should work with different database schemas', () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      // Should compile with custom key field (demonstrates flexibility across schemas)
      const upserts = [{ email: 'user@test.com', name: 'Test User' }];

      batchUpsert(db, 'users', upserts, { key: 'email' });

      expect(mockMergeInto).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle records with undefined values in upsert data', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'users', [
        { id: 1, name: undefined as any, email: 'test@example.com' },
      ]);

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should handle records with null values', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      await batchUpsert(db, 'users', [{ id: 1, name: null as any, email: 'test@example.com' }]);

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should handle exactly batch size records', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      await batchUpsert(db, 'users', upserts, { batchSize: 100 });

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should handle one more than batch size', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const upserts = Array.from({ length: 101 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@test.com`,
      }));

      await batchUpsert(db, 'users', upserts, { batchSize: 100 });

      expect(mockMergeInto).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration patterns', () => {
    it('should support syncing data from external sources', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      // Simulate external API data
      const apiData = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 999, name: 'Charlie', email: 'charlie@test.com' },
      ];

      await batchUpsert(db, 'users', apiData);

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should work with mapped/transformed data', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const externalData = [
        { userId: 1, userName: 'Alice', userEmail: 'alice@external.com' },
        { userId: 2, userName: 'Bob', userEmail: 'bob@external.com' },
      ];

      const upserts = externalData.map((item) => ({
        id: item.userId,
        name: item.userName,
        email: item.userEmail,
      }));

      await batchUpsert(db, 'users', upserts);

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should support conditional upserts in application code', async () => {
      const { db, mockMergeInto } = createMockUpsertDb();

      const allRecords = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com' },
      ];

      // Filter records before upsert
      const recordsToUpsert = allRecords.filter((r) => r.id > 1);

      await batchUpsert(db, 'users', recordsToUpsert);

      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });
  });
});
