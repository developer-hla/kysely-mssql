/**
 * Utility functions for common database operations.
 */

export { type BatchInsertOptions, batchInsert } from './batch-insert.js';
export { crossDbTable } from './cross-database.js';
export { deduplicateJoins } from './deduplicate-joins.js';
export {
  type PaginationMetadata,
  type PaginationParams,
  type PaginationResult,
  paginateQuery,
} from './paginated-query.js';
export { addQueryHint, type QueryHint } from './query-hints.js';
export {
  buildSearchFilter,
  type SearchFilterOptions,
  type SearchMode,
} from './search-filter.js';
export { callStoredProcedure } from './stored-procedure.js';
export { type TransactionOptions, wrapInTransaction } from './transaction.js';
