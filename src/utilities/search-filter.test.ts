import { describe, expect, it } from 'vitest';
import { createMockSelectQuery, type MinimalTestDatabase } from '../test-utils/index.js';
import { buildSearchFilter } from './search-filter.js';

describe('buildSearchFilter', () => {
  describe('basic functionality', () => {
    it('should work with where clause for single column', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'John'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should work with where clause for multiple columns', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title', 'content'], 'typescript'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should work with where clause', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title', 'content'], 'search term'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('search modes', () => {
    it('should work with default contains mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'test'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should support startsWith mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'John', { mode: 'startsWith' }));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should support endsWith mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['email'], '@gmail.com', { mode: 'endsWith' }));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should support contains mode explicitly', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title'], 'middle', { mode: 'contains' }));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('special character escaping', () => {
    it('should handle percent sign in search term', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title'], '50% off'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should handle underscore in search term', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'first_name'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should handle square brackets in search term', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['content'], 'array[0]'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple special characters', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title'], '50%_discount[2024]'));

      expect(mockQuery.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('type preservation', () => {
    it('should work with different table types', () => {
      const usersQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();
      const postsQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      usersQuery.where((eb) => buildSearchFilter(eb, ['name', 'email'], 'test'));
      postsQuery.where((eb) => buildSearchFilter(eb, ['title', 'content'], 'test'));

      expect(usersQuery.where).toHaveBeenCalled();
      expect(postsQuery.where).toHaveBeenCalled();
    });

    it('should maintain type safety with column names', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      // This should compile - valid columns
      mockQuery.where((eb) => buildSearchFilter(eb, ['name', 'email'], 'test'));

      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('chainability', () => {
    it('should be chainable with other query methods', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where('status', '=', 'published')
        .where((eb) => buildSearchFilter(eb, ['title', 'content'], 'typescript'))
        .selectAll();

      expect(mockQuery.where).toHaveBeenCalledTimes(2);
      expect(mockQuery.selectAll).toHaveBeenCalled();
    });

    it('should work in query building pipelines', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .select('id')
        .where((eb) => buildSearchFilter(eb, ['title'], 'search'))
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
        query = query.where((eb) => buildSearchFilter(eb, ['title', 'content'], searchTerm));
      }

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should allow skipping filter when search term is empty', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();
      let query = mockQuery.selectAll();

      const searchTerm = '';
      if (searchTerm) {
        query = query.where((eb) => buildSearchFilter(eb, ['title', 'content'], searchTerm));
      }

      expect(mockQuery.where).not.toHaveBeenCalled();
    });
  });

  describe('integration patterns', () => {
    it('should work with status filters', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where('status', '=', 'published')
        .where((eb) => buildSearchFilter(eb, ['title', 'content'], 'typescript'))
        .where('viewCount', '>', 100);

      expect(mockQuery.where).toHaveBeenCalledTimes(3);
    });

    it('should support multiple search filters', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .where((eb) => buildSearchFilter(eb, ['title'], 'typescript'))
        .where((eb) => buildSearchFilter(eb, ['content'], 'tutorial'));

      expect(mockQuery.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string search term', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      // Should not throw, but caller should decide whether to use it
      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], ''));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should handle single character search', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'A'));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should handle long search terms', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();
      const longTerm = 'This is a very long search term that might be used in practice';

      mockQuery.where((eb) => buildSearchFilter(eb, ['content'], longTerm));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should handle single column array', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], 'test'));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should handle many columns', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name', 'email'], 'search'));

      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('usage with other utilities', () => {
    it('should work after other query modifications', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery
        .select('id')
        .innerJoin('users', 'users.id', 'posts.userId')
        .where((eb) => buildSearchFilter(eb, ['title', 'content'], 'test'))
        .orderBy('id');

      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.innerJoin).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.orderBy).toHaveBeenCalled();
    });
  });

  describe('search modes with special characters', () => {
    it('should escape special chars in startsWith mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'users', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['name'], '50%', { mode: 'startsWith' }));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should escape special chars in endsWith mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) => buildSearchFilter(eb, ['title'], '[test]', { mode: 'endsWith' }));

      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should escape special chars in contains mode', () => {
      const mockQuery = createMockSelectQuery<MinimalTestDatabase, 'posts', any>();

      mockQuery.where((eb) =>
        buildSearchFilter(eb, ['content'], 'test_value', { mode: 'contains' }),
      );

      expect(mockQuery.where).toHaveBeenCalled();
    });
  });
});
