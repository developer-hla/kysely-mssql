import type { SelectQueryBuilder } from 'kysely';

const DEFAULT_PAGINATION_PAGE = 1;
const DEFAULT_PAGINATION_LIMIT = 50;

/**
 * Parameters for pagination.
 */
export interface PaginationParams {
  /** Page number (1-indexed). Default: 1 */
  page?: number;
  /** Number of records per page. Default: 50 */
  limit?: number;
}

/**
 * Metadata about the paginated result.
 */
export interface PaginationMetadata {
  /** Current page number */
  pageNumber: number;
  /** Number of records per page */
  pageSize: number;
  /** Total number of records across all pages */
  totalRecords: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Paginated query result.
 */
export interface PaginationResult<Row> {
  /** The data for the current page */
  data: Row[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Paginates a Kysely select query.
 *
 * This function executes two queries in parallel:
 * 1. A COUNT query to get the total number of records
 * 2. The data query with OFFSET and FETCH NEXT for the current page
 *
 * @param query - The Kysely select query to paginate
 * @param params - Pagination parameters (page and limit). Both must be >= 1.
 * @returns Paginated result with data and metadata
 *
 * @throws {Error} When page number is less than 1
 * @throws {Error} When limit is less than 1
 *
 * @remarks
 * **Edge Cases:**
 * - Empty results: Returns `data: []` with `totalPages: 0`
 * - Page beyond last page: Returns empty `data` array
 * - Defaults: page=1, limit=50
 *
 * **Validation:**
 * - page must be >= 1 (throws error if < 1)
 * - limit must be >= 1 (throws error if < 1)
 *
 * @example
 * ```typescript
 * const result = await paginateQuery(
 *   db.selectFrom('users').selectAll().where('active', '=', true),
 *   { page: 1, limit: 20 }
 * );
 *
 * console.log(result.data);                    // User[]
 * console.log(result.pagination.totalRecords); // Total number of users
 * console.log(result.pagination.hasNextPage);  // true/false
 * ```
 *
 * @example
 * With default pagination:
 * ```typescript
 * // Uses defaults: page=1, limit=50
 * const result = await paginateQuery(
 *   db.selectFrom('products').selectAll()
 * );
 * ```
 */
export async function paginateQuery<DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  params: PaginationParams = {},
): Promise<PaginationResult<O>> {
  const { page = DEFAULT_PAGINATION_PAGE, limit = DEFAULT_PAGINATION_LIMIT } = params;

  // Validate pagination parameters
  if (page < 1) {
    throw new Error(`Page number must be >= 1, got ${page}`);
  }
  if (limit < 1) {
    throw new Error(`Limit must be >= 1, got ${limit}`);
  }

  const offset = (page - 1) * limit;

  const countQuery = query
    .clearSelect()
    .clearLimit()
    .clearOffset()
    .clearOrderBy()
    .select((eb) => eb.fn.countAll<number>().as('count'));

  const queryWithPagination = query.fetch(limit).offset(offset);

  // Execute both queries in parallel for performance
  const [{ count }, data] = await Promise.all([
    countQuery.executeTakeFirstOrThrow() as Promise<{ count: number }>,
    queryWithPagination.execute(),
  ]);

  // Convert count to number (SQL Server may return as string)
  const totalRecords = typeof count === 'string' ? Number.parseInt(count, 10) : count;
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    data: data as O[],
    pagination: {
      pageNumber: page,
      pageSize: limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
