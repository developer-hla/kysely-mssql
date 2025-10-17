import type { Kysely } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createMockKysely, type MinimalTestDatabase } from '../test-utils/index.js';
import { batchUpdate } from './batch-update.js';

// Helper to create a mock db with updateTable support
function createMockUpdateDb() {
  const mockExecute = vi.fn().mockResolvedValue(undefined);

  // Create a chainable where mock that supports multiple calls
  const chainableWhere: any = {
    execute: mockExecute,
  };

  const mockWhere = vi.fn().mockReturnValue(chainableWhere);
  chainableWhere.where = mockWhere;

  const mockSet = vi.fn().mockReturnValue(chainableWhere);
  const mockUpdateTable = vi.fn().mockReturnValue({
    set: mockSet,
  });

  const db = {
    ...createMockKysely<MinimalTestDatabase>(),
    updateTable: mockUpdateTable,
  } as unknown as Kysely<MinimalTestDatabase>;

  return { db, mockUpdateTable, mockSet, mockWhere, mockExecute };
}

describe('batchUpdate', () => {
  describe('basic functionality', () => {
    it('should update records with default key field', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = [
        { id: 1, name: 'Alice Updated' },
        { id: 2, name: 'Bob Updated' },
      ];

      await batchUpdate(db, 'users', updates);

      expect(mockUpdateTable).toHaveBeenCalledWith('users');
    });

    it('should handle empty array without executing queries', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'users', []);

      expect(mockUpdateTable).not.toHaveBeenCalled();
    });

    it('should update single record', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Updated' }]);

      expect(mockUpdateTable).toHaveBeenCalledTimes(1);
    });

    it('should separate key field from update data', async () => {
      const { db, mockSet } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Alice', email: 'alice@test.com' }]);

      // Should call set with only name and email, not id
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice',
          email: 'alice@test.com',
        }),
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.not.objectContaining({
          id: expect.anything(),
        }),
      );
    });
  });

  describe('custom key field', () => {
    it('should support custom key field', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ email: 'user@test.com', name: 'Updated Name' }], {
        key: 'email',
      });

      expect(mockUpdateTable).toHaveBeenCalled();
    });

    it('should use custom key in WHERE clause', async () => {
      const { db, mockWhere } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ email: 'user@test.com', name: 'Updated' }], {
        key: 'email',
      });

      expect(mockWhere).toHaveBeenCalledWith('email', '=', 'user@test.com');
    });
  });

  describe('composite keys', () => {
    it('should support composite keys with multiple fields', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockUpdateTable).toHaveBeenCalled();
    });

    it('should build WHERE clause with all key fields', async () => {
      const { db, mockWhere } = createMockUpdateDb();

      await batchUpdate(db, 'posts', [{ userId: 1, status: 'published', title: 'Updated' }], {
        key: ['userId', 'status'],
      });

      expect(mockWhere).toHaveBeenCalledWith('userId', '=', 1);
      expect(mockWhere).toHaveBeenCalledWith('status', '=', 'published');
    });

    it('should exclude all key fields from update data', async () => {
      const { db, mockSet } = createMockUpdateDb();

      await batchUpdate(
        db,
        'posts',
        [{ userId: 1, status: 'published', title: 'Updated', content: 'New content' }],
        { key: ['userId', 'status'] },
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated',
          content: 'New content',
        }),
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.not.objectContaining({
          userId: expect.anything(),
          status: expect.anything(),
        }),
      );
    });
  });

  describe('batch size', () => {
    it('should respect custom batch size', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { batchSize: 3 });

      // With batch size 3 and 10 records, should make 10 update calls
      expect(mockUpdateTable).toHaveBeenCalledTimes(10);
    });

    it('should use default batch size of 1000', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates);

      // All 5 should fit in default batch
      expect(mockUpdateTable).toHaveBeenCalledTimes(5);
    });

    it('should process large datasets in batches', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = Array.from({ length: 2500 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { batchSize: 1000 });

      // 2500 records should result in 2500 update calls
      expect(mockUpdateTable).toHaveBeenCalledTimes(2500);
    });
  });

  describe('error handling', () => {
    it('should throw error when key field is missing', async () => {
      const { db } = createMockUpdateDb();

      const updates = [{ name: 'Alice' }] as any;

      await expect(batchUpdate(db, 'users', updates)).rejects.toThrow(
        "Key field 'id' is missing in update object",
      );
    });

    it('should throw error when custom key field is missing', async () => {
      const { db } = createMockUpdateDb();

      const updates = [{ name: 'Alice' }] as any;

      await expect(batchUpdate(db, 'users', updates, { key: 'email' })).rejects.toThrow(
        "Key field 'email' is missing in update object",
      );
    });

    it('should throw error when one of composite key fields is missing', async () => {
      const { db } = createMockUpdateDb();

      const updates = [{ userId: 1, title: 'Updated' }] as any;

      await expect(
        batchUpdate(db, 'posts', updates, { key: ['userId', 'status'] }),
      ).rejects.toThrow("Key field 'status' is missing in update object");
    });

    it('should validate key fields for all records in batch', async () => {
      const { db } = createMockUpdateDb();

      const updates = [
        { id: 1, name: 'Alice' },
        { name: 'Bob' }, // Missing id
      ] as any;

      await expect(batchUpdate(db, 'users', updates)).rejects.toThrow(
        "Key field 'id' is missing in update object",
      );
    });
  });

  describe('transaction support', () => {
    it('should work with transaction executor', async () => {
      const { db: tx, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(tx, 'users', [{ id: 1, name: 'Updated' }]);

      expect(mockUpdateTable).toHaveBeenCalledWith('users');
    });

    it('should execute all updates in transaction context', async () => {
      const { db: tx, mockUpdateTable } = createMockUpdateDb();

      const updates = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' },
      ];

      await batchUpdate(tx, 'users', updates);

      expect(mockUpdateTable).toHaveBeenCalledTimes(3);
    });
  });

  describe('partial updates', () => {
    it('should support updating different fields per record', async () => {
      const { db, mockSet } = createMockUpdateDb();

      await batchUpdate(db, 'users', [
        { id: 1, name: 'Alice' },
        { id: 2, email: 'bob@test.com' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com' },
      ]);

      // Check first call
      expect(mockSet).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Alice' }));

      // Check second call
      expect(mockSet).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ email: 'bob@test.com' }),
      );

      // Check third call
      expect(mockSet).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ name: 'Charlie', email: 'charlie@test.com' }),
      );
    });

    it('should allow updating only one field', async () => {
      const { db, mockSet } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ id: 1, name: 'Updated Name' }]);

      expect(mockSet).toHaveBeenCalledWith({ name: 'Updated Name' });
    });
  });

  describe('type safety', () => {
    it('should enforce table types', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      // Valid: users table with correct fields
      await batchUpdate(db, 'users', [{ id: 1, name: 'Alice' }]);

      // Valid: posts table with correct fields
      await batchUpdate(db, 'posts', [{ id: 1, title: 'Post' }]);

      expect(mockUpdateTable).toHaveBeenCalledTimes(2);
    });

    it('should work with different database schemas', () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      // Should compile with custom key field (demonstrates flexibility across schemas)
      const updates = [{ email: 'user@test.com', name: 'Test User' }];

      batchUpdate(db, 'users', updates, { key: 'email' });

      expect(mockUpdateTable).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle records with undefined values in update data', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ id: 1, name: undefined as any }]);

      expect(mockUpdateTable).toHaveBeenCalled();
    });

    it('should handle records with null values', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      await batchUpdate(db, 'users', [{ id: 1, name: null as any }]);

      expect(mockUpdateTable).toHaveBeenCalled();
    });

    it('should handle exactly batch size records', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { batchSize: 100 });

      expect(mockUpdateTable).toHaveBeenCalledTimes(100);
    });

    it('should handle one more than batch size', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const updates = Array.from({ length: 101 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
      }));

      await batchUpdate(db, 'users', updates, { batchSize: 100 });

      expect(mockUpdateTable).toHaveBeenCalledTimes(101);
    });
  });

  describe('integration patterns', () => {
    it('should support conditional updates in application code', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const allRecords = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com' },
      ];

      // Filter records before update
      const recordsToUpdate = allRecords.filter((r) => r.id > 1);

      await batchUpdate(db, 'users', recordsToUpdate);

      expect(mockUpdateTable).toHaveBeenCalledTimes(2);
    });

    it('should work with mapped/transformed data', async () => {
      const { db, mockUpdateTable } = createMockUpdateDb();

      const apiData = [
        { userId: 1, userName: 'Alice' },
        { userId: 2, userName: 'Bob' },
      ];

      const updates = apiData.map((item) => ({
        id: item.userId,
        name: item.userName,
      }));

      await batchUpdate(db, 'users', updates);

      expect(mockUpdateTable).toHaveBeenCalledTimes(2);
    });
  });
});
