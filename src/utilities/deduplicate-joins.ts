import { DeduplicateJoinsPlugin, type SelectQueryBuilder } from 'kysely';

/**
 * Applies the DeduplicateJoinsPlugin to a query to prevent duplicate joins.
 *
 * When building queries dynamically with conditional joins, you may accidentally
 * join the same table multiple times, which causes database errors. This helper
 * function applies Kysely's built-in DeduplicateJoinsPlugin to automatically
 * remove duplicate joins from your query.
 *
 * @param query - The Kysely SelectQueryBuilder to apply deduplication to
 * @returns The same query with the DeduplicateJoinsPlugin applied
 *
 * @example
 * Basic usage:
 * ```typescript
 * const query = deduplicateJoins(
 *   db.selectFrom('users')
 *     .leftJoin('posts', 'posts.userId', 'users.id')
 *     .leftJoin('posts', 'posts.userId', 'users.id') // Duplicate will be removed
 * );
 * ```
 *
 * @example
 * With $call pattern:
 * ```typescript
 * const query = db
 *   .selectFrom('users')
 *   .leftJoin('posts', 'posts.userId', 'users.id')
 *   .$call(deduplicateJoins)
 *   .selectAll();
 * ```
 *
 * @example
 * With dynamic/conditional joins:
 * ```typescript
 * let query = db.selectFrom('plots')
 *   .$call(deduplicateJoins);
 *
 * if (includeRegion) {
 *   query = query.leftJoin('regions', 'regions.code', 'plots.regionCode');
 * }
 *
 * if (searchTerm) {
 *   // This might also add a leftJoin to regions
 *   query = query.leftJoin('regions', 'regions.code', 'plots.regionCode');
 * }
 *
 * // Without deduplicateJoins, this would error if both conditions are true
 * const results = await query.selectAll().execute();
 * ```
 *
 * @see {@link https://kysely.dev/docs/recipes/deduplicate-joins | Kysely DeduplicateJoins Recipe}
 */
export function deduplicateJoins<DB, TB extends keyof DB & string, O>(
  query: SelectQueryBuilder<DB, TB, O>,
): SelectQueryBuilder<DB, TB, O> {
  return query.withPlugin(new DeduplicateJoinsPlugin());
}
