/**
 * Utility functions for common database operations.
 */

export type {
  BatchKysely,
  BatchMethods,
  BatchResult,
  BatchTransaction,
} from './batch/batch-kysely.js';
export type { BatchUpdateOptions } from './batch/update.js';
export type { BatchUpsertOptions } from './batch/upsert.js';
export { createCrossDbHelper } from './cross-database.js';
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
export { wrapInTransaction } from './transaction.js';
