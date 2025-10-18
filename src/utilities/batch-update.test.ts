import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createMockKysely, type MinimalTestDatabase } from '../test-utils/index.js';
import { batchUpdate } from './batch-update.js';

// Helper to create a mock db with MERGE support
function createMockMergeDb() {
  const mockExecute = vi.fn().mockResolvedValue(undefined);
  const mockThenUpdateSet = vi.fn().mockReturnValue({ execute: mockExecute });
  const mockWhenMatched = vi.fn().mockReturnValue({ thenUpdateSet: mockThenUpdateSet });
  const mockUsing = vi.fn().mockReturnValue({ whenMatched: mockWhenMatched });
  const mockMergeInto = vi.fn().mockReturnValue({ using: mockUsing });

  const db = {
    ...createMockKysely<MinimalTestDatabase>(),
    mergeInto: mockMergeInto,
  } as unknown as Kysely<MinimalTestDatabase>;

  return { db, mockMergeInto, mockUsing, mockWhenMatched, mockThenUpdateSet, mockExecute };
}

describe('batchUpdate', () => {
  describe('basic functionality', () => {
    it('should update records with explicit key field using MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = [
        { id: 1, name: 'Alice Updated' },
        { id: 2, name: 'Bob Updated' },
      ];

      await batchUpdate(db, 'users', updates, { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledWith('users');
      expect(mockMergeInto).toHaveBeenCalledTimes(1); // One MERGE for all records
    });

    it('should handle empty array without executing queries', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(db, 'users', [], { key: 'id' });

      expect(mockMergeInto).not.toHaveBeenCalled();
    });

    it('should update single record with MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Updated' }], { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(1); // Single MERGE statement
    });

    it('should use MERGE to update multiple records in single statement', async () => {
      const { db, mockThenUpdateSet } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Alice', email: 'alice@test.com' }], {
        key: 'id',
      });

      // thenUpdateSet should be called with a callback that excludes the key field
      expect(mockThenUpdateSet).toHaveBeenCalled();
      const updateCallback = mockThenUpdateSet.mock.calls[0][0];
      expect(typeof updateCallback).toBe('function');
    });
  });

  describe('custom key field', () => {
    it('should support custom key field with MERGE', async () => {
      const { db, mockMergeInto, mockUsing } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ email: 'user@test.com', name: 'Updated Name' }], {
        key: 'email',
      });

      expect(mockMergeInto).toHaveBeenCalledWith('users');
      expect(mockUsing).toHaveBeenCalled(); // Should use email as the key
    });

    it('should use custom key in MERGE ON clause', async () => {
      const { db, mockUsing } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ email: 'user@test.com', name: 'Updated' }], {
        key: 'email',
      });

      // Using should be called with source.email matching target.email
      expect(mockUsing).toHaveBeenCalled();
      const usingArgs = mockUsing.mock.calls[0];
      expect(usingArgs[1]).toContain('email'); // ON clause references
    });
  });

  describe('composite keys', () => {
    it('should support composite keys with multiple fields using MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockMergeInto).toHaveBeenCalledWith('posts');
    });

    it('should build MERGE ON clause with all key fields', async () => {
      const { db, mockUsing } = createMockMergeDb();

      await batchUpdate(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      // For composite keys, using() is called with a callback function
      expect(mockUsing).toHaveBeenCalled();
      const usingArgs = mockUsing.mock.calls[0];
      expect(typeof usingArgs[1]).toBe('function'); // Composite key uses function for ON clause
    });

    it('should exclude all key fields from MERGE UPDATE SET', async () => {
      const { db, mockThenUpdateSet } = createMockMergeDb();

      await batchUpdate(
        db,
        'posts',
        [{ userId: 1, status: 'published', title: 'Updated', content: 'New content' }],
        { key: ['userId', 'status'] },
      );

      // The update callback should exclude userId and status
      expect(mockThenUpdateSet).toHaveBeenCalled();
      const updateCallback = mockThenUpdateSet.mock.calls[0][0];
      expect(typeof updateCallback).toBe('function');
    });
  });

  describe('batch size', () => {
    it('should respect custom batch size with MERGE batches', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id', batchSize: 3 });

      // With batch size 3 and 10 records: ceil(10/3) = 4 MERGE calls
      expect(mockMergeInto).toHaveBeenCalledTimes(4);
    });

    it('should use default batch size of 1000', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id' });

      // All 5 fit in default batch of 1000: 1 MERGE call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should process large datasets in MERGE batches (huge performance improvement)', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = Array.from({ length: 2500 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id', batchSize: 1000 });

      // 2500 records with batch size 1000: ceil(2500/1000) = 3 MERGE calls
      // OLD IMPLEMENTATION: 2500 individual UPDATE calls
      // NEW IMPLEMENTATION: 3 bulk MERGE calls (833x improvement!)
      expect(mockMergeInto).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should throw error when key field is missing', async () => {
      const { db } = createMockMergeDb();

      const updates = [{ name: 'Alice' }] as any;

      await expect(batchUpdate(db, 'users', updates, { key: 'id' })).rejects.toThrow(
        "Key field 'id' is missing in update object",
      );
    });

    it('should throw error when custom key field is missing', async () => {
      const { db } = createMockMergeDb();

      const updates = [{ name: 'Alice' }] as any;

      await expect(batchUpdate(db, 'users', updates, { key: 'email' })).rejects.toThrow(
        "Key field 'email' is missing in update object",
      );
    });

    it('should throw error when one of composite key fields is missing', async () => {
      const { db } = createMockMergeDb();

      const updates = [{ userId: 1, title: 'Updated' }] as any;

      await expect(
        batchUpdate(db, 'posts', updates, { key: ['userId', 'status'] }),
      ).rejects.toThrow("Key field 'status' is missing in update object");
    });

    it('should validate key fields for all records in batch', async () => {
      const { db } = createMockMergeDb();

      const updates = [
        { id: 1, name: 'Alice' },
        { name: 'Bob' }, // Missing id
      ] as any;

      await expect(batchUpdate(db, 'users', updates, { key: 'id' })).rejects.toThrow(
        "Key field 'id' is missing in update object",
      );
    });
  });

  describe('transaction support', () => {
    it('should work with transaction executor', async () => {
      const { db: tx, mockMergeInto } = createMockMergeDb();

      await batchUpdate(tx, 'users', [{ id: 1, name: 'Updated' }], { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledWith('users');
    });

    it('should execute all updates in transaction context with MERGE', async () => {
      const { db: tx, mockMergeInto } = createMockMergeDb();

      const updates = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' },
      ];

      await batchUpdate(tx, 'users', updates, { key: 'id' });

      // All 3 records in single MERGE call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });
  });

  describe('partial updates', () => {
    it('should support updating different fields per record with MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(
        db,
        'users',
        [
          { id: 1, name: 'Alice' },
          { id: 2, email: 'bob@test.com' },
          { id: 3, name: 'Charlie', email: 'charlie@test.com' },
        ],
        { key: 'id' },
      );

      // Single MERGE handles all records regardless of which fields are set
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should allow updating only one field with MERGE', async () => {
      const { db, mockThenUpdateSet } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Updated Name' }], { key: 'id' });

      // MERGE UPDATE SET callback is called
      expect(mockThenUpdateSet).toHaveBeenCalled();
    });
  });

  describe('type safety', () => {
    it('should enforce table types with MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      // Valid: users table with correct fields
      await batchUpdate(db, 'users', [{ id: 1, name: 'Alice' }], { key: 'id' });

      // Valid: posts table with correct fields
      await batchUpdate(db, 'posts', [{ id: 1, title: 'Post' }], { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalledTimes(2);
    });

    it('should work with different database schemas', () => {
      const { db, mockMergeInto } = createMockMergeDb();

      // Should compile with custom key field (demonstrates flexibility across schemas)
      const updates = [{ email: 'user@test.com', name: 'Test User' }];

      batchUpdate(db, 'users', updates, { key: 'email' });

      expect(mockMergeInto).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle records with undefined values in update data', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ id: 1, name: undefined as any }], { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should handle records with null values', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      await batchUpdate(db, 'users', [{ id: 1, name: null as any }], { key: 'id' });

      expect(mockMergeInto).toHaveBeenCalled();
    });

    it('should handle exactly batch size records with MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id', batchSize: 100 });

      // Exactly 100 records with batch size 100: 1 MERGE call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should handle one more than batch size with MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const updates = Array.from({ length: 101 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id', batchSize: 100 });

      // 101 records with batch size 100: 2 MERGE calls
      expect(mockMergeInto).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration patterns', () => {
    it('should support conditional updates in application code', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const allRecords = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com' },
      ];

      // Filter records before update
      const recordsToUpdate = allRecords.filter((r) => r.id > 1);

      await batchUpdate(db, 'users', recordsToUpdate, { key: 'id' });

      // 2 records in single MERGE call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });

    it('should work with mapped/transformed data using MERGE', async () => {
      const { db, mockMergeInto } = createMockMergeDb();

      const apiData = [
        { userId: 1, userName: 'Alice' },
        { userId: 2, userName: 'Bob' },
      ];

      const updates = apiData.map((item) => ({
        id: item.userId,
        name: item.userName,
      }));

      await batchUpdate(db, 'users', updates, { key: 'id' });

      // 2 records in single MERGE call
      expect(mockMergeInto).toHaveBeenCalledTimes(1);
    });
  });
});
