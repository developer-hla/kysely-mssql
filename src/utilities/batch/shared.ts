import type { AliasedRawBuilder } from 'kysely';
import { sql } from 'kysely';

/**
 * SQL Server has a limit of 2100 parameters per query.
 * We use 2000 as a safe limit to leave some headroom.
 */
const SQL_SERVER_SAFE_PARAMETER_LIMIT = 2000;

/**
 * Default batch size when we can't calculate optimal size
 * (e.g., when values array is empty or user provides override).
 */
export const DEFAULT_BATCH_SIZE = 1000;

/**
 * Calculates the optimal batch size based on SQL Server's parameter limit.
 *
 * SQL Server has a limit of 2100 parameters per query. This function calculates
 * the maximum safe batch size based on the number of columns in each record.
 *
 * @param recordShape - A sample record to determine column count
 * @returns The optimal batch size that won't exceed SQL Server's parameter limit
 *
 * @remarks
 * **How it works:**
 * - Parameters per batch = batchSize × columnCount
 * - Safe batch size = floor(2000 / columnCount)
 * - Automatically uses the largest safe batch size for optimal performance
 *
 * @example
 * ```typescript
 * // Record with 5 columns
 * const record = { id: 1, name: 'A', email: 'a@test.com', age: 25, active: true };
 * const batchSize = calculateOptimalBatchSize(record);
 * // Returns 400 (400 * 5 = 2000 parameters)
 * ```
 *
 * @example
 * ```typescript
 * // Record with 10 columns
 * const record = { col1: 1, col2: 2, ..., col10: 10 };
 * const batchSize = calculateOptimalBatchSize(record);
 * // Returns 200 (200 * 10 = 2000 parameters)
 * ```
 */
export function calculateOptimalBatchSize(recordShape: Record<string, unknown>): number {
  const columnCount = Object.keys(recordShape).length;

  if (columnCount === 0) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.floor(SQL_SERVER_SAFE_PARAMETER_LIMIT / columnCount);
}

/**
 * Helper function to create a VALUES table constructor for use in MERGE USING clause.
 * Transforms an array of records into a SQL VALUES expression with column aliases.
 *
 * @param records - Array of records to transform into VALUES clause
 * @param alias - Alias name for the VALUES table (e.g., 'source')
 * @returns An aliased raw SQL builder representing the VALUES table
 *
 * @remarks
 * This is used internally by batch update and upsert operations to construct
 * the source table for SQL Server's MERGE statement.
 *
 * @example
 * ```typescript
 * const data = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' }
 * ];
 * const source = createValuesSource(data, 'source');
 * // Generates SQL: (VALUES (1, 'Alice'), (2, 'Bob')) AS source(id, name)
 * ```
 *
 * @internal
 */
export function createValuesSource<R extends Record<string, unknown>, A extends string>(
  records: R[],
  alias: A,
): AliasedRawBuilder<R, A> {
  const keys = Object.keys(records[0]);

  const valueRows = sql.join(
    records.map((record) => {
      const values = sql.join(
        keys.map((key) => sql`${sql.val(record[key])}`),
        sql`, `,
      );
      return sql`(${values})`;
    }),
    sql`, `,
  );

  const wrappedAlias = sql.ref(alias);
  const wrappedColumns = sql.join(keys.map(sql.ref), sql`, `);
  const aliasSql = sql`${wrappedAlias}(${wrappedColumns})`;

  return sql<R>`(VALUES ${valueRows})`.as<A>(aliasSql);
}

/**
 * Validates that all required key fields are present in update/upsert records.
 *
 * @param records - Array of records to validate
 * @param keys - Array of required key field names
 * @param batchStartIndex - Starting index of this batch (for error messages)
 * @param operationType - Type of operation (for error messages): 'update' or 'upsert'
 * @throws {Error} When a required key field is missing from a record
 *
 * @internal
 */
export function validateKeyFields(
  records: Record<string, unknown>[],
  keys: readonly string[],
  batchStartIndex: number,
  operationType: 'update' | 'upsert',
): void {
  records.forEach((record, recordIndex) => {
    for (const key of keys) {
      const keyValue = record[key];
      if (keyValue === undefined) {
        const absoluteIndex = batchStartIndex + recordIndex;
        throw new Error(
          `Key field '${key}' is missing in ${operationType} object at index ${absoluteIndex}. Record: ${JSON.stringify(record).slice(0, 200)}`,
        );
      }
    }
  });
}
