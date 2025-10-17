import { DeduplicateJoinsPlugin } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createMockSelectQuery, type MinimalTestDatabase } from '../test-utils/index.js';
import { deduplicateJoins } from './deduplicate-joins.js';

describe('deduplicateJoins', () => {
  describe('basic functionality', () => {
    it('should return a query with DeduplicateJoinsPlugin applied', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = deduplicateJoins(mockQuery);

      expect(mockQuery.withPlugin).toHaveBeenCalledTimes(1);
      expect(mockQuery.withPlugin).toHaveBeenCalledWith(expect.any(DeduplicateJoinsPlugin));
      expect(result).toBe(mockQuery);
    });

    it('should be callable as a standalone function', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      deduplicateJoins(mockQuery);

      expect(mockQuery.withPlugin).toHaveBeenCalledWith(expect.any(DeduplicateJoinsPlugin));
    });
  });

  describe('$call pattern', () => {
    it('should work with $call method', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = mockQuery.$call(deduplicateJoins);

      expect(result).toBe(mockQuery);
    });

    it('should be chainable with $call', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = mockQuery.$call(deduplicateJoins).select('id');

      expect(mockQuery.select).toHaveBeenCalledWith('id');
      expect(result).toBe(mockQuery);
    });
  });

  describe('type preservation', () => {
    it('should preserve query return type', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = deduplicateJoins(mockQuery);

      // TypeScript compilation test - result should have same type as mockQuery
      expect(result).toBe(mockQuery);
    });

    it('should work with different table types', () => {
      const postsQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      const result = deduplicateJoins(postsQuery);

      expect(postsQuery.withPlugin).toHaveBeenCalled();
      expect(result).toBe(postsQuery);
    });
  });

  describe('chainability', () => {
    it('should be chainable with other query methods', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = deduplicateJoins(mockQuery).where('id', '=', 1).selectAll();

      expect(mockQuery.where).toHaveBeenCalledWith('id', '=', 1);
      expect(mockQuery.selectAll).toHaveBeenCalled();
      expect(result).toBe(mockQuery);
    });

    it('should work in query building pipelines', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = mockQuery
        .select('id')
        .$call(deduplicateJoins)
        .where('name', 'like', '%test%')
        .orderBy('id');

      expect(mockQuery.select).toHaveBeenCalledWith('id');
      expect(mockQuery.withPlugin).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalledWith('name', 'like', '%test%');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('id');
      expect(result).toBe(mockQuery);
    });
  });

  describe('plugin application', () => {
    it('should call withPlugin with DeduplicateJoinsPlugin instance', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();
      const withPluginSpy = vi.spyOn(mockQuery, 'withPlugin');

      deduplicateJoins(mockQuery);

      expect(withPluginSpy).toHaveBeenCalledTimes(1);
      const pluginArg = withPluginSpy.mock.calls[0]?.[0];
      expect(pluginArg).toBeInstanceOf(DeduplicateJoinsPlugin);
    });

    it('should create a new plugin instance each time', () => {
      const mockQuery1 = createMockSelectQuery<MinimalTestDatabase, 'users', any>();
      const mockQuery2 = createMockSelectQuery<MinimalTestDatabase, 'users', any>();
      const withPluginSpy1 = vi.spyOn(mockQuery1, 'withPlugin');
      const withPluginSpy2 = vi.spyOn(mockQuery2, 'withPlugin');

      deduplicateJoins(mockQuery1);
      deduplicateJoins(mockQuery2);

      const plugin1 = withPluginSpy1.mock.calls[0]?.[0];
      const plugin2 = withPluginSpy2.mock.calls[0]?.[0];

      expect(plugin1).toBeInstanceOf(DeduplicateJoinsPlugin);
      expect(plugin2).toBeInstanceOf(DeduplicateJoinsPlugin);
      expect(plugin1).not.toBe(plugin2);
    });
  });

  describe('usage patterns', () => {
    it('should support conditional query building', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();
      let query = deduplicateJoins(mockQuery);

      const includeEmail = true;
      if (includeEmail) {
        query = query.select('email');
      }

      expect(mockQuery.withPlugin).toHaveBeenCalled();
      expect(mockQuery.select).toHaveBeenCalledWith('email');
    });

    it('should support dynamic join scenarios', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      // Simulate applying plugin before dynamic joins
      const queryWithPlugin = deduplicateJoins(mockQuery);
      queryWithPlugin.leftJoin('posts', 'posts.userId', 'users.id');
      queryWithPlugin.leftJoin('posts', 'posts.userId', 'users.id'); // Duplicate

      expect(mockQuery.withPlugin).toHaveBeenCalled();
      expect(mockQuery.leftJoin).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration with other utilities', () => {
    it('should work with $call after other query modifications', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      const result = mockQuery
        .select('id')
        .where('name', '=', 'Test')
        .$call(deduplicateJoins)
        .orderBy('id');

      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.withPlugin).toHaveBeenCalled();
      expect(mockQuery.orderBy).toHaveBeenCalled();
      expect(result).toBe(mockQuery);
    });
  });
});
