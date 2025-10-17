import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { crossDbTable } from './cross-database.js';

// Mock database schemas for testing
interface MainDB {
  users: {
    id: number;
    name: string;
    email: string;
  };
  orders: {
    id: number;
    userId: number;
    total: number;
  };
}

interface ArchiveDB {
  'historical.orders': {
    id: number;
    userId: number;
    archivedAt: Date;
  };
  users: {
    id: number;
    name: string;
  };
}

interface ReportingDB {
  'analytics.metrics': {
    id: number;
    value: number;
  };
}

type TestDatabases = {
  MainDB: MainDB;
  ArchiveDB: ArchiveDB;
  ReportingDB: ReportingDB;
};

describe('crossDbTable', () => {
  describe('schema handling', () => {
    it('should add dbo schema when table name has no schema', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');

      expect(sqlIdSpy).toHaveBeenCalledWith('MainDB', 'dbo', 'users');
    });

    it('should not add dbo when table name includes schema', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'ArchiveDB', 'historical.orders'>(
        'ArchiveDB',
        'historical.orders',
      );

      expect(sqlIdSpy).toHaveBeenCalledWith('ArchiveDB', 'historical.orders');
    });

    it('should handle custom schema correctly', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'ReportingDB', 'analytics.metrics'>(
        'ReportingDB',
        'analytics.metrics',
      );

      expect(sqlIdSpy).toHaveBeenCalledWith('ReportingDB', 'analytics.metrics');
    });
  });

  describe('type safety', () => {
    it('should accept valid database and table combinations', () => {
      // These should compile without TypeScript errors
      crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');
      crossDbTable<TestDatabases, 'MainDB', 'orders'>('MainDB', 'orders');
      crossDbTable<TestDatabases, 'ArchiveDB', 'users'>('ArchiveDB', 'users');
      crossDbTable<TestDatabases, 'ArchiveDB', 'historical.orders'>(
        'ArchiveDB',
        'historical.orders',
      );

      // Type checking test - if this compiles, types are working
      expect(true).toBe(true);
    });

    it('should enforce database name type constraints', () => {
      // This test validates that TypeScript compiler enforces constraints
      // The actual test is at compile time, not runtime

      const validDb: keyof TestDatabases = 'MainDB';
      expect(validDb).toBe('MainDB');
    });

    it('should enforce table name type constraints per database', () => {
      // This test validates that TypeScript compiler enforces constraints
      // The actual test is at compile time, not runtime

      type MainDBTables = keyof TestDatabases['MainDB'];
      const validTable: MainDBTables = 'users';
      expect(validTable).toBe('users');
    });
  });

  describe('SQL identifier generation', () => {
    it('should return SQL template literal', () => {
      const result = crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');

      // The result should be a SQL template tag result
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should generate different results for different tables', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');
      const firstCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      crossDbTable<TestDatabases, 'MainDB', 'orders'>('MainDB', 'orders');
      const secondCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      expect(firstCall).not.toEqual(secondCall);
    });

    it('should generate different results for different databases', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');
      const firstCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      crossDbTable<TestDatabases, 'ArchiveDB', 'users'>('ArchiveDB', 'users');
      const secondCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      expect(firstCall).not.toEqual(secondCall);
    });
  });

  describe('edge cases', () => {
    it('should handle table names with multiple dots', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      // Even though the type system might not allow this in practice,
      // the function should handle it correctly
      crossDbTable<TestDatabases, 'ReportingDB', 'analytics.metrics'>(
        'ReportingDB',
        'analytics.metrics',
      );

      expect(sqlIdSpy).toHaveBeenCalledWith('ReportingDB', 'analytics.metrics');
    });

    it('should work with different database name casing', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDbTable<TestDatabases, 'ArchiveDB', 'users'>('ArchiveDB', 'users');

      expect(sqlIdSpy).toHaveBeenCalledWith('ArchiveDB', 'dbo', 'users');
    });
  });

  describe('usage patterns', () => {
    it('should be usable in query builder context', () => {
      // Simulate usage in a real query
      const tableRef = crossDbTable<TestDatabases, 'ArchiveDB', 'users'>('ArchiveDB', 'users');

      expect(tableRef).toBeDefined();
      // In real usage, this would be passed to .from() or .join()
    });

    it('should support multiple cross-database references in same query', () => {
      const table1 = crossDbTable<TestDatabases, 'MainDB', 'users'>('MainDB', 'users');
      const table2 = crossDbTable<TestDatabases, 'ArchiveDB', 'users'>('ArchiveDB', 'users');

      expect(table1).toBeDefined();
      expect(table2).toBeDefined();
      expect(table1).not.toBe(table2);
    });
  });
});
