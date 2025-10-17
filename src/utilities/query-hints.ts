import { type SelectQueryBuilder, sql } from 'kysely';

/**
 * SQL Server query hints that can be used with the OPTION clause.
 *
 * @see https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-query
 */
export type QueryHint =
  | 'CONCAT UNION'
  | `FAST ${number}`
  | `HASH ${'GROUP' | 'JOIN' | 'UNION'}`
  | 'KEEP PLAN'
  | 'KEEPFIXED PLAN'
  | 'LOOP JOIN'
  | `MAXDOP ${number}`
  | `MAXRECURSION ${number}`
  | `MERGE ${'JOIN' | 'UNION'}`
  | 'OPTIMIZE FOR UNKNOWN'
  | 'ORDER GROUP'
  | 'RECOMPILE'
  | 'ROBUST PLAN';

/**
 * Adds one or more SQL Server query hints to a SELECT query using the OPTION clause.
 *
 * Query hints provide directives to the SQL Server query optimizer about how to
 * process the query. Common use cases include:
 *
 * - **RECOMPILE**: Force query recompilation on each execution (useful for queries with
 *   highly variable parameters)
 * - **MAXDOP N**: Limit the maximum degree of parallelism to N processors
 * - **OPTIMIZE FOR UNKNOWN**: Tell optimizer to use average statistics instead of
 *   parameter sniffing (helps with parameter sensitivity issues)
 * - **KEEPFIXED PLAN**: Prevent recompilation due to statistics changes
 * - **FAST N**: Optimize for retrieving the first N rows quickly
 *
 * @template DB - The database schema type
 * @template TB - The table name(s) being queried
 * @template O - The output type of the query
 *
 * @param query - The Kysely SELECT query to add hints to
 * @param hint - A single query hint or array of hints to apply
 *
 * @returns The query with the OPTION clause appended
 *
 * @example
 * Single hint:
 * ```typescript
 * const users = await db
 *   .selectFrom('users')
 *   .selectAll()
 *   .where('status', '=', 'active')
 *   .$call((qb) => addQueryHint(qb, 'RECOMPILE'))
 *   .execute();
 * // Generates: SELECT * FROM users WHERE status = 'active' OPTION (RECOMPILE)
 * ```
 *
 * @example
 * Multiple hints:
 * ```typescript
 * const report = await db
 *   .selectFrom('sales')
 *   .select(['region', 'total'])
 *   .$call((qb) => addQueryHint(qb, ['MAXDOP 4', 'RECOMPILE']))
 *   .execute();
 * // Generates: SELECT region, total FROM sales OPTION (MAXDOP 4, RECOMPILE)
 * ```
 *
 * @example
 * With complex queries:
 * ```typescript
 * const slowQuery = await db
 *   .selectFrom('orders')
 *   .innerJoin('customers', 'customers.id', 'orders.customerId')
 *   .select(['orders.id', 'customers.name'])
 *   .where('orders.date', '>', new Date('2024-01-01'))
 *   .$call((qb) => addQueryHint(qb, 'OPTIMIZE FOR UNKNOWN'))
 *   .execute();
 * ```
 */
export function addQueryHint<DB, TB extends keyof DB & string, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  hint: QueryHint | QueryHint[],
): SelectQueryBuilder<DB, TB, O> {
  const hints = Array.isArray(hint) ? hint : [hint];
  const hintString = hints.join(', ');

  // Use sql.raw to prevent Kysely from creating a parameter for the hint
  const optionClause = sql.raw(`OPTION (${hintString})`);

  return query.modifyEnd(sql`${optionClause}`);
}
