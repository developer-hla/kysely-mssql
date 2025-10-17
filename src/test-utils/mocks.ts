import type { Kysely, SelectQueryBuilder, Transaction } from 'kysely';
import { vi } from 'vitest';

/**
 * Creates a mock Kysely database instance for testing.
 *
 * The mock includes a transaction builder that can execute callbacks.
 * Additional methods can be added by tests as needed.
 *
 * @example
 * ```typescript
 * const mockDb = createMockKysely<TestDatabase>();
 * await mockDb.transaction().execute(async (trx) => {
 *   // Test code here
 * });
 * ```
 */
export function createMockKysely<DB>(): Kysely<DB> {
  const mockTransaction = createMockTransaction<DB>();

  const mockTransactionBuilder = {
    execute: vi.fn().mockImplementation((callback) => {
      return callback(mockTransaction);
    }),
  };

  return {
    transaction: vi.fn().mockReturnValue(mockTransactionBuilder),
  } as unknown as Kysely<DB>;
}

/**
 * Creates a mock Transaction for testing.
 *
 * Tests can add specific methods as needed.
 *
 * @example
 * ```typescript
 * const mockTrx = createMockTransaction<TestDatabase>();
 * ```
 */
export function createMockTransaction<DB>(): Transaction<DB> {
  return {} as Transaction<DB>;
}

/**
 * Creates a mock SelectQueryBuilder for testing query operations.
 *
 * Includes common query builder methods that return `this` for chaining.
 * Tests can override specific methods or add additional ones as needed.
 *
 * @example
 * Basic usage:
 * ```typescript
 * const mockQuery = createMockSelectQuery<TestDatabase, 'users', any>();
 * mockQuery.where('id', '=', 1);
 * ```
 *
 * @example
 * Override specific methods:
 * ```typescript
 * const mockQuery = createMockSelectQuery<TestDatabase, 'users', User>({
 *   execute: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
 * });
 * const results = await mockQuery.execute();
 * ```
 */
export function createMockSelectQuery<DB, TB extends keyof DB & string, O>(
  overrides?: Partial<SelectQueryBuilder<DB, TB, O>>,
): SelectQueryBuilder<DB, TB, O> {
  const mockQuery = {
    // Selection methods
    select: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    clearSelect: vi.fn().mockReturnThis(),

    // Filtering methods
    where: vi.fn().mockReturnThis(),
    clearWhere: vi.fn().mockReturnThis(),

    // Joining methods
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),

    // Ordering methods
    orderBy: vi.fn().mockReturnThis(),
    clearOrderBy: vi.fn().mockReturnThis(),

    // Pagination methods
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    fetch: vi.fn().mockReturnThis(),
    clearLimit: vi.fn().mockReturnThis(),
    clearOffset: vi.fn().mockReturnThis(),

    // Grouping methods
    groupBy: vi.fn().mockReturnThis(),
    clearGroupBy: vi.fn().mockReturnThis(),

    // Modification methods
    modifyEnd: vi.fn().mockReturnThis(),
    modifyFront: vi.fn().mockReturnThis(),
    $call: vi.fn((fn) => fn(mockQuery)),

    // Execution methods
    execute: vi.fn().mockResolvedValue([]),
    executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),

    // Compilation
    compile: vi.fn().mockReturnValue({ sql: 'SELECT * FROM table', parameters: [] }),

    ...overrides,
  };

  return mockQuery as unknown as SelectQueryBuilder<DB, TB, O>;
}

/**
 * Creates a mock SelectQueryBuilder with pagination support for testing paginateQuery.
 *
 * This specialized mock is configured to simulate the query transformations
 * that occur during pagination (count query, data query).
 *
 * @param countResult - The total number of records for the count query
 * @param dataResult - The array of records to return for the data query
 *
 * @example
 * ```typescript
 * const mockQuery = createMockPaginatedQuery(100, [
 *   { id: 1, name: 'User 1' },
 *   { id: 2, name: 'User 2' },
 * ]);
 *
 * const result = await paginateQuery(mockQuery, { page: 1, limit: 50 });
 * expect(result.pagination.totalRecords).toBe(100);
 * expect(result.data).toHaveLength(2);
 * ```
 */
export function createMockPaginatedQuery<T>(
  countResult: number,
  dataResult: T[],
): SelectQueryBuilder<any, any, T> {
  return createMockSelectQuery<any, any, T>({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: countResult }),
    execute: vi.fn().mockResolvedValue(dataResult),
  });
}
