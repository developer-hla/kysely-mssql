import { type Kysely, sql } from 'kysely';

/**
 * Executes a SQL Server stored procedure with typed parameters and results.
 *
 * This function constructs and executes an EXEC statement with the provided
 * parameters, returning the result set typed as the specified Result type.
 *
 * @param db - The Kysely database instance
 * @param procedureName - Name of the stored procedure to execute
 * @param params - Dictionary of parameter names and values
 * @returns Array of result rows typed as Result
 *
 * @example
 * Basic usage:
 * ```typescript
 * interface ProductResult {
 *   ProductID: number;
 *   ProductName: string;
 *   Price: number;
 * }
 *
 * const products = await callStoredProcedure<Database, ProductResult>(
 *   db,
 *   'sp_GetProductsByCategory',
 *   {
 *     CategoryID: 5,
 *     Active: true,
 *     MinPrice: 10.00
 *   }
 * );
 *
 * // SQL Output:
 * // /\* caller: getProducts *\/ EXEC sp_GetProductsByCategory @CategoryID=5, @Active=1, @MinPrice=10.00
 * ```
 *
 * @example
 * With null parameters:
 * ```typescript
 * const results = await callStoredProcedure<Database, UserResult>(
 *   db,
 *   'sp_GetUsersByRole',
 *   {
 *     RoleName: 'Admin',
 *     DepartmentID: null  // NULL parameter
 *   }
 * );
 * ```
 *
 * @example
 * With Date parameters:
 * ```typescript
 * const orders = await callStoredProcedure<Database, OrderResult>(
 *   db,
 *   'sp_GetOrdersByDateRange',
 *   {
 *     StartDate: new Date('2025-01-01'),
 *     EndDate: new Date('2025-12-31')
 *   }
 * );
 * ```
 */
export async function callStoredProcedure<
  DB,
  Result extends Record<string, unknown> = Record<string, unknown>,
>(
  db: Kysely<DB>,
  procedureName: string,
  params: Record<string, string | number | boolean | Date | null>,
): Promise<Result[]> {
  const sqlParams = Object.entries(params).map(([key, value]) => {
    // Use sql.ref for proper identifier escaping instead of sql.raw
    return sql`@${sql.ref(key)}=${value}`;
  });

  const paramString = sql.join(sqlParams, sql`, `);
  const query = sql`EXEC ${sql.raw(procedureName)} ${paramString}`;
  const compiledQuery = query.compile(db);
  const result = await db.executeQuery<Result>(compiledQuery);

  return result.rows;
}
