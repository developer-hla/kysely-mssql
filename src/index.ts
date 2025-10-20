/**
 * @dev-hla/kysely-mssql
 *
 * Opinionated Kysely wrapper for MS SQL Server with built-in observability,
 * error handling, and utilities.
 *
 * Features:
 * - Query origin tracking (automatic SQL comments showing caller context)
 * - Typed error handling (SQL Server errors mapped to TypeScript exceptions)
 * - Performance optimizations (VarChar type overrides)
 * - Pagination utilities
 * - Transaction composition helpers
 * - Stored procedure support
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { createConnection } from '@dev-hla/kysely-mssql';
 *
 * const db = createConnection<Database>({
 *   server: 'localhost',
 *   database: 'MyDB',
 *   user: 'sa',
 *   password: 'password',
 *   appName: 'my-app', // Required!
 * });
 *
 * // All queries include caller tracking automatically:
 * const users = await db.selectFrom('users').selectAll().execute();
 * // SQL: /\* caller: getUserList *\/ SELECT * FROM users
 * ```
 *
 * @packageDocumentation
 */

// ===== KYSELY RE-EXPORTS =====
export {
  type AliasedExpression,
  DeduplicateJoinsPlugin,
  type InferResult,
  type InsertObject,
  type Kysely,
  type SelectQueryBuilder,
  sql,
  type Transaction,
  type UpdateObject,
  type ValueExpression,
} from 'kysely';
// ===== CONNECTION =====
export { type ConnectionConfig, createConnection } from './connection/index.js';
// ===== ERRORS =====
export {
  DatabaseConnectionError,
  DatabaseError,
  DataTooLongError,
  DuplicateKeyError,
  ForeignKeyError,
  InvalidDataTypeError,
  RequiredFieldError,
  TransactionConflictError,
  TransactionDeadlockError,
} from './errors/index.js';
// ===== LOGGING =====
export { createLogger, type LogLevel } from './logging/index.js';
export type { Executor } from './types.js';

// ===== BATCH OPERATIONS =====
// All batch operations are available as instance methods on the BatchKysely<DB>
// instance returned from createConnection():
//   - db.batchInsert(table, values)
//   - db.batchUpdate(table, values, { key: ... })
//   - db.batchUpsert(table, values, { key: ... })
//
// These methods automatically calculate optimal batch sizes and wrap operations
// in transactions for atomic all-or-nothing behavior.
export {
  type BatchKysely,
  type BatchMethods,
  type BatchResult,
  type BatchTransaction,
  type BatchUpdateOptions,
  type BatchUpsertOptions,
} from './utilities/index.js';

// ===== UTILITIES =====
export {
  addQueryHint,
  buildSearchFilter,
  callStoredProcedure,
  createCrossDbHelper,
  deduplicateJoins,
  type PaginationMetadata,
  type PaginationParams,
  type PaginationResult,
  paginateQuery,
  type QueryHint,
  type SearchFilterOptions,
  type SearchMode,
  wrapInTransaction,
} from './utilities/index.js';
