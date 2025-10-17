import type { ExpressionBuilder } from 'kysely';

/**
 * Escapes special LIKE pattern characters for SQL Server.
 *
 * Escapes the following characters: %, _, [, ]
 *
 * @param value - The string to escape
 * @returns The escaped string safe for use in LIKE patterns
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\[/g, '[[]').replace(/]/g, '[]]').replace(/%/g, '[%]').replace(/_/g, '[_]');
}

/**
 * Search mode determining wildcard placement in LIKE patterns.
 */
export type SearchMode = 'contains' | 'startsWith' | 'endsWith';

/**
 * Options for configuring search filter behavior.
 */
export interface SearchFilterOptions {
  /**
   * Search mode determining wildcard placement.
   * - 'contains': Matches anywhere in the string (%term%)
   * - 'startsWith': Matches beginning of string (term%)
   * - 'endsWith': Matches end of string (%term)
   *
   * @default 'contains'
   */
  mode?: SearchMode;
}

/**
 * Builds a search filter that performs LIKE searches across multiple columns with OR logic.
 *
 * Automatically escapes special LIKE pattern characters (%, _, [, ]) in the search term
 * to prevent unintended wildcard matching.
 *
 * @param columns - Array of column names to search
 * @param searchTerm - The term to search for
 * @param options - Optional configuration for search behavior
 * @returns Expression builder function for use with .where()
 *
 * @example
 * Basic usage:
 * ```typescript
 * const results = await db
 *   .selectFrom('posts')
 *   .where(buildSearchFilter(['title', 'content'], 'typescript'))
 *   .selectAll()
 *   .execute();
 * // SQL: WHERE (title LIKE '%typescript%' OR content LIKE '%typescript%')
 * ```
 *
 * @example
 * With different search modes:
 * ```typescript
 * // Starts with
 * .where(buildSearchFilter(['name'], 'John', { mode: 'startsWith' }))
 * // SQL: WHERE name LIKE 'John%'
 *
 * // Ends with
 * .where(buildSearchFilter(['email'], '@gmail.com', { mode: 'endsWith' }))
 * // SQL: WHERE email LIKE '%@gmail.com'
 * ```
 *
 * @example
 * Conditional search:
 * ```typescript
 * let query = db.selectFrom('products').selectAll();
 *
 * if (searchTerm) {
 *   query = query.where(
 *     buildSearchFilter(['name', 'description', 'sku'], searchTerm)
 *   );
 * }
 *
 * const results = await query.execute();
 * ```
 *
 * @example
 * With pagination:
 * ```typescript
 * const query = db
 *   .selectFrom('posts')
 *   .where(buildSearchFilter(['title', 'content'], searchTerm))
 *   .selectAll()
 *   .orderBy('created_at', 'desc');
 *
 * const results = await paginateQuery(query, { page: 1, limit: 20 });
 * ```
 *
 * @example
 * Combining with other filters:
 * ```typescript
 * const results = await db
 *   .selectFrom('posts')
 *   .where('status', '=', 'published')
 *   .where(buildSearchFilter(['title', 'content'], searchTerm))
 *   .where('created_at', '>', new Date('2024-01-01'))
 *   .selectAll()
 *   .execute();
 * ```
 */
export function buildSearchFilter<DB, TB extends keyof DB & string>(
  columns: readonly (keyof DB[TB] & string)[],
  searchTerm: string,
  options?: SearchFilterOptions,
) {
  return (eb: ExpressionBuilder<DB, TB>) => {
    const mode = options?.mode ?? 'contains';
    const escapedTerm = escapeLikePattern(searchTerm);
    const pattern =
      mode === 'startsWith'
        ? `${escapedTerm}%`
        : mode === 'endsWith'
          ? `%${escapedTerm}`
          : `%${escapedTerm}%`;

    const expressions = columns.map((col) => eb(col as any, 'like', pattern as any));
    return eb.or(expressions);
  };
}
