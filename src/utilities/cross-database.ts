import { sql } from 'kysely';

/**
 * Creates a type-safe table reference for cross-database joins in SQL Server.
 *
 * SQL Server supports querying tables across multiple databases on the same server
 * using three-part or four-part naming:
 * - Three-part: `DatabaseName.SchemaName.TableName`
 * - Four-part: `ServerName.DatabaseName.SchemaName.TableName`
 *
 * This utility helps construct these references with full TypeScript type safety,
 * ensuring that database names and table names are validated at compile time.
 *
 * @template DBMap - A type mapping database names to their schema definitions
 * @template DB - The database name (must be a key in DBMap)
 * @template Table - The table name (must be a key in the selected database's schema)
 *
 * @param database - The name of the database containing the table
 * @param table - The table name, optionally including schema (e.g., 'dbo.users' or 'users')
 *
 * @returns A Kysely SQL identifier that can be used in queries
 *
 * @example
 * Define your database mapping:
 * ```typescript
 * import type { DB as MainSchema } from './main-db-schema';
 * import type { DB as ArchiveSchema } from './archive-db-schema';
 *
 * type MyDatabases = {
 *   MainDB: MainSchema,
 *   ArchiveDB: ArchiveSchema,
 * };
 * ```
 *
 * @example
 * Simple cross-database query:
 * ```typescript
 * const results = await db
 *   .selectFrom('users')
 *   .innerJoin(
 *     crossDbTable<MyDatabases, 'ArchiveDB', 'orders'>('ArchiveDB', 'orders'),
 *     'ArchiveDB.dbo.orders.userId',
 *     'users.id'
 *   )
 *   .selectAll()
 *   .execute();
 * ```
 *
 * @example
 * With explicit schema:
 * ```typescript
 * const table = crossDbTable<MyDatabases, 'ArchiveDB', 'reporting.sales'>(
 *   'ArchiveDB',
 *   'reporting.sales'
 * );
 * // Generates: ArchiveDB.reporting.sales
 * ```
 *
 * @example
 * Default schema (dbo):
 * ```typescript
 * const table = crossDbTable<MyDatabases, 'MainDB', 'users'>('MainDB', 'users');
 * // Generates: MainDB.dbo.users (dbo added automatically)
 * ```
 *
 * @example
 * Complex cross-database join with aggregation:
 * ```typescript
 * const report = await db
 *   .selectFrom(crossDbTable<MyDatabases, 'ArchiveDB', 'orders'>('ArchiveDB', 'orders'))
 *   .innerJoin('customers', 'customers.id', 'ArchiveDB.dbo.orders.customerId')
 *   .select((eb) => [
 *     'customers.name',
 *     eb.fn.count('ArchiveDB.dbo.orders.id').as('orderCount'),
 *   ])
 *   .groupBy('customers.name')
 *   .execute();
 * ```
 */
export function crossDbTable<
  DBMap extends Record<string, Record<string, any>>,
  DB extends keyof DBMap & string,
  Table extends keyof DBMap[DB] & string,
>(database: DB, table: Table): any {
  // If the table name doesn't include a schema (no dot), default to 'dbo'
  if (!table.includes('.')) {
    return sql`${sql.id(database, 'dbo', table)}`;
  }

  // Table name includes schema, use it directly
  return sql`${sql.id(database, table)}`;
}
