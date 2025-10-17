import type { SelectQueryBuilder } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import type { MinimalTestDatabase } from '../test-utils/index.js';
import { paginateQuery } from './paginated-query.js';

describe('paginateQuery', () => {
  /**
   * Helper to create a mock SelectQueryBuilder that tracks method calls
   * and can return predetermined results.
   */
  function createMockQuery<T>(countResult: number, dataResult: T[]) {
    const mockQuery = {
      clearSelect: vi.fn().mockReturnThis(),
      clearLimit: vi.fn().mockReturnThis(),
      clearOffset: vi.fn().mockReturnThis(),
      clearOrderBy: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      fetch: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: countResult }),
      execute: vi.fn().mockResolvedValue(dataResult),
    };

    return mockQuery as unknown as SelectQueryBuilder<MinimalTestDatabase, 'users' | 'posts', T>;
  }

  describe('default parameters', () => {
    it('should use page=1 and limit=50 by default', async () => {
      const mockQuery = createMockQuery(100, Array(50).fill({ id: 1 }));

      await paginateQuery(mockQuery);

      expect(mockQuery.fetch).toHaveBeenCalledWith(50);
      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });

    it('should use provided page parameter', async () => {
      const mockQuery = createMockQuery(100, Array(50).fill({ id: 1 }));

      await paginateQuery(mockQuery, { page: 3 });

      expect(mockQuery.fetch).toHaveBeenCalledWith(50);
      expect(mockQuery.offset).toHaveBeenCalledWith(100);
    });

    it('should use provided limit parameter', async () => {
      const mockQuery = createMockQuery(100, Array(20).fill({ id: 1 }));

      await paginateQuery(mockQuery, { limit: 20 });

      expect(mockQuery.fetch).toHaveBeenCalledWith(20);
      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });
  });

  describe('offset calculation', () => {
    it('should calculate offset correctly for page 1', async () => {
      const mockQuery = createMockQuery(100, []);

      await paginateQuery(mockQuery, { page: 1, limit: 20 });

      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });

    it('should calculate offset correctly for page 2', async () => {
      const mockQuery = createMockQuery(100, []);

      await paginateQuery(mockQuery, { page: 2, limit: 20 });

      expect(mockQuery.offset).toHaveBeenCalledWith(20);
    });

    it('should calculate offset correctly for page 5', async () => {
      const mockQuery = createMockQuery(100, []);

      await paginateQuery(mockQuery, { page: 5, limit: 25 });

      expect(mockQuery.offset).toHaveBeenCalledWith(100);
    });
  });

  describe('count query building', () => {
    it('should clear select, limit, offset, and orderBy for count query', async () => {
      const mockQuery = createMockQuery(100, []);

      await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(mockQuery.clearSelect).toHaveBeenCalled();
      expect(mockQuery.clearLimit).toHaveBeenCalled();
      expect(mockQuery.clearOffset).toHaveBeenCalled();
      expect(mockQuery.clearOrderBy).toHaveBeenCalled();
    });

    it('should add COUNT(*) select to count query', async () => {
      const mockQuery = createMockQuery(100, []);

      await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(mockQuery.select).toHaveBeenCalled();
    });
  });

  describe('result formatting', () => {
    it('should return data and pagination metadata', async () => {
      const testData = [{ id: 1, name: 'Test' }];
      const mockQuery = createMockQuery(100, testData);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(testData);
    });

    it('should calculate totalPages correctly', async () => {
      const mockQuery = createMockQuery(125, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should set pageNumber and pageSize correctly', async () => {
      const mockQuery = createMockQuery(100, []);

      const result = await paginateQuery(mockQuery, { page: 2, limit: 25 });

      expect(result.pagination.pageNumber).toBe(2);
      expect(result.pagination.pageSize).toBe(25);
    });

    it('should set totalRecords correctly', async () => {
      const mockQuery = createMockQuery(157, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.totalRecords).toBe(157);
    });

    it('should convert string count to number', async () => {
      const mockQuery = createMockQuery('200' as unknown as number, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.totalRecords).toBe(200);
      expect(typeof result.pagination.totalRecords).toBe('number');
    });
  });

  describe('pagination metadata', () => {
    it('should set hasNextPage to true when not on last page', async () => {
      const mockQuery = createMockQuery(150, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should set hasNextPage to false when on last page', async () => {
      const mockQuery = createMockQuery(150, []);

      const result = await paginateQuery(mockQuery, { page: 3, limit: 50 });

      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should set hasPreviousPage to false when on first page', async () => {
      const mockQuery = createMockQuery(150, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should set hasPreviousPage to true when not on first page', async () => {
      const mockQuery = createMockQuery(150, []);

      const result = await paginateQuery(mockQuery, { page: 2, limit: 50 });

      expect(result.pagination.hasPreviousPage).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', async () => {
      const mockQuery = createMockQuery(0, []);

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.data).toEqual([]);
      expect(result.pagination.totalRecords).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle single page of results', async () => {
      const mockQuery = createMockQuery(25, Array(25).fill({ id: 1 }));

      const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });

      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle exact page boundary', async () => {
      const mockQuery = createMockQuery(100, Array(50).fill({ id: 1 }));

      const result = await paginateQuery(mockQuery, { page: 2, limit: 50 });

      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle large page numbers', async () => {
      const mockQuery = createMockQuery(1000, []);

      const result = await paginateQuery(mockQuery, { page: 10, limit: 50 });

      expect(result.pagination.pageNumber).toBe(10);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });
  });
});
