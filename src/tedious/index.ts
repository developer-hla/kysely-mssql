/**
 * Tedious customizations for SQL Server connectivity.
 *
 * This module provides:
 * - Custom Request class with automatic error mapping
 * - Type overwrites for VarChar performance optimization
 * - Error mapping utilities
 */

export { mapDatabaseError } from './error-mapper.js';
export { Request } from './Request.js';
export {
  TEDIOUS_TYPE_NCHAR_OVERWRITE,
  TEDIOUS_TYPE_NVARCHAR_OVERWRITE,
  TEDIOUS_TYPE_UNICODE_OVERWRITES,
} from './type-overwrites.js';
