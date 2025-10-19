import { describe, expect, it, vi } from 'vitest';
import {
  createMockKysely,
  createMockTransaction,
  type MinimalTestDatabase,
} from '../../test-utils/index.js';
import { batchInsert } from './insert.js';

describe('batchInsert', () => {
  describe('basic functionality', () => {
    it('should insert records in a single batch when under batch size', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([{ numInsertedOrUpdatedRows: 5n }]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
        { name: 'User 3', email: 'user3@example.com' },
        { name: 'User 4', email: 'user4@example.com' },
        { name: 'User 5', email: 'user5@example.com' },
      ];

      await batchInsert(mockDb, 'users', values);

      expect(mockDb.insertInto).toHaveBeenCalledTimes(1);
      expect(mockDb.insertInto).toHaveBeenCalledWith('users');
      expect(mockInsertQuery.values).toHaveBeenCalledTimes(1);
      expect(mockInsertQuery.values).toHaveBeenCalledWith(values);
      expect(mockInsertQuery.execute).toHaveBeenCalledTimes(1);
    });

    it('should insert records in multiple batches when over batch size', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([{ numInsertedOrUpdatedRows: 1000n }]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // Create 2500 records (should split into 3 batches of 1000, 1000, 500)
      const values = Array.from({ length: 2500 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockDb, 'users', values);

      expect(mockDb.insertInto).toHaveBeenCalledTimes(3);
      expect(mockInsertQuery.values).toHaveBeenCalledTimes(3);
      expect(mockInsertQuery.execute).toHaveBeenCalledTimes(3);

      // Verify batch sizes
      expect(mockInsertQuery.values).toHaveBeenNthCalledWith(1, values.slice(0, 1000));
      expect(mockInsertQuery.values).toHaveBeenNthCalledWith(2, values.slice(1000, 2000));
      expect(mockInsertQuery.values).toHaveBeenNthCalledWith(3, values.slice(2000, 2500));
    });
  });

  describe('automatic batch sizing', () => {
    it('should use optimal batch size based on column count', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = Array.from({ length: 1500 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockDb, 'users', values);

      // 2 columns → batch size 1000 → ceil(1500/1000) = 2 batches
      expect(mockDb.insertInto).toHaveBeenCalledTimes(2);
    });

    it('should insert small arrays in single batch', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
      ];

      await batchInsert(mockDb, 'users', values);

      // Small array fits in one batch
      expect(mockDb.insertInto).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      mockDb.insertInto = vi.fn();

      await batchInsert(mockDb, 'users', []);

      expect(mockDb.insertInto).not.toHaveBeenCalled();
    });

    it('should handle single record', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [{ name: 'User 1', email: 'user1@example.com' }];

      await batchInsert(mockDb, 'users', values);

      expect(mockDb.insertInto).toHaveBeenCalledTimes(1);
      expect(mockInsertQuery.values).toHaveBeenCalledWith(values);
    });

    it('should handle exact batch size multiples', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // Exactly 2000 records with batch size 1000
      const values = Array.from({ length: 2000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockDb, 'users', values);

      // Should split into exactly 2 batches
      expect(mockDb.insertInto).toHaveBeenCalledTimes(2);
      expect(mockInsertQuery.values).toHaveBeenCalledTimes(2);
    });

    it('should handle non-multiple batch sizes', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // 1234 records with 2 columns → batch size 1000
      const values = Array.from({ length: 1234 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockDb, 'users', values);

      // ceil(1234/1000) = 2 batches (1000, 234)
      expect(mockDb.insertInto).toHaveBeenCalledTimes(2);
    });
  });

  describe('transaction support', () => {
    it('should work with Kysely database instance', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [{ name: 'User 1', email: 'user1@example.com' }];

      await batchInsert(mockDb, 'users', values);

      expect(mockDb.insertInto).toHaveBeenCalled();
    });

    it('should work with Transaction instance', async () => {
      const mockTx = createMockTransaction<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockTx.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [{ name: 'User 1', email: 'user1@example.com' }];

      await batchInsert(mockTx, 'users', values);

      expect(mockTx.insertInto).toHaveBeenCalled();
    });

    it('should execute all batches within same transaction', async () => {
      const mockTx = createMockTransaction<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockTx.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = Array.from({ length: 2500 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockTx, 'users', values);

      // All 3 batches should use the same transaction
      expect(mockTx.insertInto).toHaveBeenCalledTimes(3);
      expect(mockInsertQuery.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('type safety', () => {
    it('should work with different table types', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const users = [{ name: 'User 1', email: 'user1@example.com' }];
      const posts = [{ title: 'Post 1', content: 'Content 1', userId: 1, viewCount: 0 }];

      await batchInsert(mockDb, 'users', users);
      await batchInsert(mockDb, 'posts', posts);

      expect(mockDb.insertInto).toHaveBeenCalledWith('users');
      expect(mockDb.insertInto).toHaveBeenCalledWith('posts');
    });

    it('should maintain InsertObject type safety', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // Valid user objects
      const validUsers = [
        { name: 'User 1', email: 'user1@example.com' },
        { name: 'User 2', email: 'user2@example.com' },
      ];

      await batchInsert(mockDb, 'users', validUsers);

      expect(mockInsertQuery.values).toHaveBeenCalledWith(validUsers);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from execute', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockError = new Error('Database connection failed');
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      const values = [{ name: 'User 1', email: 'user1@example.com' }];

      await expect(batchInsert(mockDb, 'users', values)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should fail fast on first batch error', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockError = new Error('Constraint violation');
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValueOnce(mockError),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // Create 2500 records (would be 3 batches)
      const values = Array.from({ length: 2500 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await expect(batchInsert(mockDb, 'users', values)).rejects.toThrow('Constraint violation');

      // Should only execute once before failing
      expect(mockInsertQuery.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('performance patterns', () => {
    it('should process large datasets efficiently', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // 10,000 records with batch size 1000
      const values = Array.from({ length: 10000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      await batchInsert(mockDb, 'users', values);

      // Should execute exactly 10 batches
      expect(mockDb.insertInto).toHaveBeenCalledTimes(10);
      expect(mockInsertQuery.execute).toHaveBeenCalledTimes(10);
    });

    it('should calculate smaller batch sizes for parameter-heavy records', async () => {
      const mockDb = createMockKysely<MinimalTestDatabase>();
      const mockInsertQuery = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      };
      mockDb.insertInto = vi.fn().mockReturnValue(mockInsertQuery);

      // Simulate records with many columns (20 columns)
      const values = Array.from({ length: 1000 }, (_, i) => ({
        col1: i,
        col2: i,
        col3: i,
        col4: i,
        col5: i,
        col6: i,
        col7: i,
        col8: i,
        col9: i,
        col10: i,
        col11: i,
        col12: i,
        col13: i,
        col14: i,
        col15: i,
        col16: i,
        col17: i,
        col18: i,
        col19: i,
        col20: i,
      }));

      await batchInsert(mockDb, 'users', values);

      // 20 columns → floor(2000/20) = 100 batch size → ceil(1000/100) = 10 batches
      expect(mockDb.insertInto).toHaveBeenCalledTimes(10);
    });
  });
});
