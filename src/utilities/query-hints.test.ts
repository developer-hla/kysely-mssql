import { type SelectQueryBuilder, sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { addQueryHint, type QueryHint } from './query-hints.js';

// Mock database type for testing
interface TestDB {
  users: {
    id: number;
    name: string;
    status: string;
  };
}

describe('addQueryHint', () => {
  describe('single hint', () => {
    it('should add RECOMPILE hint to query', () => {
      const mockQuery = createMockQuery();

      const result = addQueryHint(mockQuery, 'RECOMPILE');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockQuery);
    });

    it('should add MAXDOP hint with number to query', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'MAXDOP 4');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should add OPTIMIZE FOR UNKNOWN hint', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'OPTIMIZE FOR UNKNOWN');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should add KEEPFIXED PLAN hint', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'KEEPFIXED PLAN');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should add FAST hint with number', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'FAST 10');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should add HASH GROUP hint', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'HASH GROUP');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should add LOOP JOIN hint', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, 'LOOP JOIN');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple hints', () => {
    it('should add multiple hints as array', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, ['RECOMPILE', 'MAXDOP 4']);

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should combine three hints', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, ['RECOMPILE', 'MAXDOP 4', 'OPTIMIZE FOR UNKNOWN']);

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });

    it('should handle array with single hint', () => {
      const mockQuery = createMockQuery();

      addQueryHint(mockQuery, ['RECOMPILE']);

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('type safety', () => {
    it('should accept all valid QueryHint types', () => {
      const mockQuery = createMockQuery();

      const validHints: QueryHint[] = [
        'CONCAT UNION',
        'FAST 100',
        'HASH GROUP',
        'HASH JOIN',
        'HASH UNION',
        'KEEP PLAN',
        'KEEPFIXED PLAN',
        'LOOP JOIN',
        'MAXDOP 8',
        'MAXRECURSION 32',
        'MERGE JOIN',
        'MERGE UNION',
        'OPTIMIZE FOR UNKNOWN',
        'ORDER GROUP',
        'RECOMPILE',
        'ROBUST PLAN',
      ];

      for (const hint of validHints) {
        addQueryHint(mockQuery, hint);
      }

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(validHints.length);
    });

    it('should preserve query return type', () => {
      const mockQuery = createMockQuery();

      const result = addQueryHint(mockQuery, 'RECOMPILE');

      // TypeScript compilation test - result should have same type as mockQuery
      expect(result).toBe(mockQuery);
    });
  });

  describe('SQL generation', () => {
    it('should use sql.raw to prevent parameterization', () => {
      const mockQuery = createMockQuery();
      const sqlRawSpy = vi.spyOn(sql, 'raw');

      addQueryHint(mockQuery, 'RECOMPILE');

      expect(sqlRawSpy).toHaveBeenCalledWith('OPTION (RECOMPILE)');
    });

    it('should format multiple hints with comma separator', () => {
      const mockQuery = createMockQuery();
      const sqlRawSpy = vi.spyOn(sql, 'raw');

      addQueryHint(mockQuery, ['MAXDOP 4', 'RECOMPILE']);

      expect(sqlRawSpy).toHaveBeenCalledWith('OPTION (MAXDOP 4, RECOMPILE)');
    });

    it('should format three hints correctly', () => {
      const mockQuery = createMockQuery();
      const sqlRawSpy = vi.spyOn(sql, 'raw');

      addQueryHint(mockQuery, ['HASH JOIN', 'MAXDOP 2', 'RECOMPILE']);

      expect(sqlRawSpy).toHaveBeenCalledWith('OPTION (HASH JOIN, MAXDOP 2, RECOMPILE)');
    });
  });

  describe('integration patterns', () => {
    it('should work with $call pattern', () => {
      const mockQuery = createMockQuery();

      // Simulating the $call pattern usage
      const queryWithHint = addQueryHint(mockQuery, 'RECOMPILE');

      expect(queryWithHint).toBe(mockQuery);
      expect(mockQuery.modifyEnd).toHaveBeenCalled();
    });

    it('should be chainable', () => {
      const mockQuery = createMockQuery();

      const result = addQueryHint(addQueryHint(mockQuery, 'RECOMPILE'), 'MAXDOP 4');

      expect(mockQuery.modifyEnd).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockQuery);
    });
  });
});

/**
 * Creates a mock SelectQueryBuilder for testing
 */
function createMockQuery(): SelectQueryBuilder<TestDB, 'users', any> {
  return {
    modifyEnd: vi.fn().mockReturnThis(),
  } as any;
}
