import tedious from 'tedious';

/**
 * Tedious type overwrites for SQL Server performance optimization.
 *
 * By default, Kysely's MssqlDialect uses NVarChar (2 bytes per character, Unicode)
 * for all string parameters. However, many SQL Server databases use VarChar
 * (1 byte per character, ASCII) columns.
 *
 * Using NVarChar parameters with VarChar columns can cause:
 * - Implicit conversions in queries
 * - Index scans instead of index seeks
 * - Query plan cache pollution
 * - Performance degradation
 *
 * These overwrites force VarChar/Char types to match your database schema.
 *
 * @see https://github.com/kysely-org/kysely/issues/1164
 * @see https://github.com/kysely-org/kysely/issues/1161
 */

/**
 * Forces NVarChar to use VarChar instead.
 * Use this if your database primarily uses VarChar columns.
 */
export const TEDIOUS_TYPE_NVARCHAR_OVERWRITE = {
  NVarChar: tedious.TYPES.VarChar,
} as const;

/**
 * Forces NChar to use Char instead.
 * Use this if your database uses fixed-length Char columns.
 */
export const TEDIOUS_TYPE_NCHAR_OVERWRITE = {
  NChar: tedious.TYPES.Char,
} as const;

/**
 * Combined overwrites for both NVarChar and NChar.
 * Use this if your database uses ASCII types throughout (most common).
 */
export const TEDIOUS_TYPE_UNICODE_OVERWRITES = {
  ...TEDIOUS_TYPE_NVARCHAR_OVERWRITE,
  ...TEDIOUS_TYPE_NCHAR_OVERWRITE,
} as const;
