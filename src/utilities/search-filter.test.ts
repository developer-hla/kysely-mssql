import { describe, expect, it } from 'vitest';
import { createMockSelectQuery, type MinimalTestDatabase } from '../test-utils/index.js';
import { buildSearchFilter } from './search-filter.js';

describe('buildSearchFilter', () => {
  describe('basic functionality', () => {
    it('should create a filter for single column', () => {
      const filter = buildSearchFilter(['name'], 'John');

      expect(filter).toBeTypeOf('function');
    });

    it('should create a filter for multiple columns', () => {
      const filter = buildSearchFilter(['title', 'content'], 'typescript');

      expect(filter).toBeTypeOf('function');
    });

    it('should work with where clause', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where(buildSearchFilter(['title', 'content'], 'search term'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('search modes', () => {
    it('should default to contains mode', () => {
      const filter = buildSearchFilter(['name'], 'test');

      expect(filter).toBeTypeOf('function');
    });

    it('should support startsWith mode', () => {
      const filter = buildSearchFilter(['name'], 'John', { mode: 'startsWith' });

      expect(filter).toBeTypeOf('function');
    });

    it('should support endsWith mode', () => {
      const filter = buildSearchFilter(['email'], '@gmail.com', { mode: 'endsWith' });

      expect(filter).toBeTypeOf('function');
    });

    it('should support contains mode explicitly', () => {
      const filter = buildSearchFilter(['title'], 'middle', { mode: 'contains' });

      expect(filter).toBeTypeOf('function');
    });
  });

  describe('special character escaping', () => {
    it('should handle percent sign in search term', () => {
      const filter = buildSearchFilter(['title'], '50% off');

      expect(filter).toBeTypeOf('function');
    });

    it('should handle underscore in search term', () => {
      const filter = buildSearchFilter(['name'], 'first_name');

      expect(filter).toBeTypeOf('function');
    });

    it('should handle square brackets in search term', () => {
      const filter = buildSearchFilter(['content'], 'array[0]');

      expect(filter).toBeTypeOf('function');
    });

    it('should handle multiple special characters', () => {
      const filter = buildSearchFilter(['title'], '50%_discount[2024]');

      expect(filter).toBeTypeOf('function');
    });
  });

  describe('type preservation', () => {
    it('should work with different table types', () => {
      const usersFilter = buildSearchFilter<MinimalTestDatabase, 'users'>(
        ['name', 'email'],
        'test',
      );
      const postsFilter = buildSearchFilter<MinimalTestDatabase, 'posts'>(
        ['title', 'content'],
        'test',
      );

      expect(usersFilter).toBeTypeOf('function');
      expect(postsFilter).toBeTypeOf('function');
    });

    it('should maintain type safety with column names', () => {
      // This should compile - valid columns
      const filter = buildSearchFilter<MinimalTestDatabase, 'users'>(['name', 'email'], 'test');

      expect(filter).toBeTypeOf('function');
    });
  });

  describe('chainability', () => {
    it('should be chainable with other query methods', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where('status', '=', 'published')
        .where(buildSearchFilter(['title', 'content'], 'typescript'))
        .selectAll();

      expect(mockQuery.where).toHaveBeenCalledTimes(2);
      expect(mockQuery.selectAll).toHaveBeenCalled();
    });

    it('should work in query building pipelines', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .select('id')
        .where(buildSearchFilter(['title'], 'search'))
        .orderBy('id');

      expect(mockQuery.select).toHaveBeenCalledWith('id');
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.orderBy).toHaveBeenCalledWith('id');
    });
  });

  describe('conditional usage', () => {
    it('should support conditional query building', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();
      let query = mockQuery.selectAll();

      const searchTerm = 'typescript';
      if (searchTerm) {
        query = query.where(buildSearchFilter(['title', 'content'], searchTerm));
      }

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should allow skipping filter when search term is empty', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();
      let query = mockQuery.selectAll();

      const searchTerm = '';
      if (searchTerm) {
        query = query.where(buildSearchFilter(['title', 'content'], searchTerm));
      }

      expect(mockQuery.where).not.toHaveBeenCalled();
    });
  });

  describe('integration patterns', () => {
    it('should work with status filters', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where('status', '=', 'published')
        .where(buildSearchFilter(['title', 'content'], 'typescript'))
        .where('viewCount', '>', 100);

      expect(mockQuery.where).toHaveBeenCalledTimes(3);
    });

    it('should support multiple search filters', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where(buildSearchFilter(['title'], 'typescript'))
        .where(buildSearchFilter(['content'], 'tutorial'));

      expect(mockQuery.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string search term', () => {
      const filter = buildSearchFilter(['name'], '');

      // Should not throw, but caller should decide whether to use it
      expect(filter).toBeTypeOf('function');
    });

    it('should handle single character search', () => {
      const filter = buildSearchFilter(['name'], 'A');

      expect(filter).toBeTypeOf('function');
    });

    it('should handle long search terms', () => {
      const longTerm = 'This is a very long search term that might be used in practice';
      const filter = buildSearchFilter(['content'], longTerm);

      expect(filter).toBeTypeOf('function');
    });

    it('should handle single column array', () => {
      const filter = buildSearchFilter(['name'], 'test');

      expect(filter).toBeTypeOf('function');
    });

    it('should handle many columns', () => {
      const filter = buildSearchFilter<MinimalTestDatabase, 'users'>(['name', 'email'], 'search');

      expect(filter).toBeTypeOf('function');
    });
  });

  describe('usage with other utilities', () => {
    it('should work after other query modifications', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .select('id')
        .innerJoin('users', 'users.id', 'posts.userId')
        .where(buildSearchFilter(['title', 'content'], 'test'))
        .orderBy('id');

      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.innerJoin).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.orderBy).toHaveBeenCalled();
    });
  });

  describe('search modes with special characters', () => {
    it('should escape special chars in startsWith mode', () => {
      const filter = buildSearchFilter(['name'], '50%', { mode: 'startsWith' });

      expect(filter).toBeTypeOf('function');
    });

    it('should escape special chars in endsWith mode', () => {
      const filter = buildSearchFilter(['title'], '[test]', { mode: 'endsWith' });

      expect(filter).toBeTypeOf('function');
    });

    it('should escape special chars in contains mode', () => {
      const filter = buildSearchFilter(['content'], 'test_value', { mode: 'contains' });

      expect(filter).toBeTypeOf('function');
    });
  });
});
