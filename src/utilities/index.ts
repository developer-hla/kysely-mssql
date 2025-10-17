/**
 * Utility functions for common database operations.
 */

export { crossDbTable } from './cross-database.js';
export { deduplicateJoins } from './deduplicate-joins.js';
export {
  type PaginationMetadata,
  type PaginationParams,
  type PaginationResult,
  paginateQuery,
} from './paginated-query.js';
export { addQueryHint, type QueryHint } from './query-hints.js';
export { callStoredProcedure } from './stored-procedure.js';
export { type TransactionOptions, wrapInTransaction } from './transaction.js';
