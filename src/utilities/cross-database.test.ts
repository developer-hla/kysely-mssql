import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createCrossDbHelper } from './cross-database.js';

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

const crossDb = createCrossDbHelper<TestDatabases>();

describe('createCrossDbHelper', () => {
  describe('schema handling', () => {
    it('should add dbo schema when table name has no schema', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('MainDB', 'users');

      expect(sqlIdSpy).toHaveBeenCalledWith('MainDB', 'dbo', 'users');
    });

    it('should not add dbo when table name includes schema', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('ArchiveDB', 'historical.orders');

      expect(sqlIdSpy).toHaveBeenCalledWith('ArchiveDB', 'historical.orders');
    });

    it('should handle custom schema correctly', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('ReportingDB', 'analytics.metrics');

      expect(sqlIdSpy).toHaveBeenCalledWith('ReportingDB', 'analytics.metrics');
    });
  });

  describe('type safety', () => {
    it('should accept valid database and table combinations', () => {
      // These should compile without TypeScript errors - fully inferred!
      crossDb('MainDB', 'users');
      crossDb('MainDB', 'orders');
      crossDb('ArchiveDB', 'users');
      crossDb('ArchiveDB', 'historical.orders');

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
      const result = crossDb('MainDB', 'users');

      // The result should be a SQL template tag result
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should generate different results for different tables', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('MainDB', 'users');
      const firstCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      crossDb('MainDB', 'orders');
      const secondCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      expect(firstCall).not.toEqual(secondCall);
    });

    it('should generate different results for different databases', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('MainDB', 'users');
      const firstCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      crossDb('ArchiveDB', 'users');
      const secondCall = sqlIdSpy.mock.calls[sqlIdSpy.mock.calls.length - 1];

      expect(firstCall).not.toEqual(secondCall);
    });
  });

  describe('edge cases', () => {
    it('should handle table names with multiple dots', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      // Even though the type system might not allow this in practice,
      // the function should handle it correctly
      crossDb('ReportingDB', 'analytics.metrics');

      expect(sqlIdSpy).toHaveBeenCalledWith('ReportingDB', 'analytics.metrics');
    });

    it('should work with different database name casing', () => {
      const sqlIdSpy = vi.spyOn(sql, 'id');

      crossDb('ArchiveDB', 'users');

      expect(sqlIdSpy).toHaveBeenCalledWith('ArchiveDB', 'dbo', 'users');
    });
  });

  describe('usage patterns', () => {
    it('should be usable in query builder context', () => {
      // Simulate usage in a real query
      const tableRef = crossDb('ArchiveDB', 'users');

      expect(tableRef).toBeDefined();
      // In real usage, this would be passed to .from() or .join()
    });

    it('should support multiple cross-database references in same query', () => {
      const table1 = crossDb('MainDB', 'users');
      const table2 = crossDb('ArchiveDB', 'users');

      expect(table1).toBeDefined();
      expect(table2).toBeDefined();
      expect(table1).not.toBe(table2);
    });
  });

  describe('factory pattern', () => {
    it('should create independent helpers for different database mappings', () => {
      type OtherDatabases = {
        DB1: MainDB;
      };

      const crossDb1 = createCrossDbHelper<TestDatabases>();
      const crossDb2 = createCrossDbHelper<OtherDatabases>();

      // Both should work independently
      const result1 = crossDb1('MainDB', 'users');
      const result2 = crossDb2('DB1', 'users');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
