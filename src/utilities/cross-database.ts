import { type RawBuilder, sql } from 'kysely';

/**
 * Creates a cross-database helper with full type inference for your database mapping.
 *
 * SQL Server supports querying tables across multiple databases on the same server
 * using three-part naming: `DatabaseName.SchemaName.TableName`
 *
 * This factory function creates a helper that provides full TypeScript type safety
 * and inference for cross-database queries.
 *
 * @template DBMap - A type mapping database names to their schema definitions
 *
 * @returns A helper function for creating type-safe cross-database table references
 *
 * @example
 * Define your database mapping and create helper:
 * ```typescript
 * import type { DB as MainSchema } from './main-db-schema';
 * import type { DB as ArchiveSchema } from './archive-db-schema';
 *
 * type MyDatabases = {
 *   MainDB: MainSchema,
 *   ArchiveDB: ArchiveSchema,
 * };
 *
 * const crossDb = createCrossDbHelper<MyDatabases>();
 * ```
 *
 * @example
 * Simple cross-database query with full type inference:
 * ```typescript
 * const results = await db
 *   .selectFrom('users')
 *   .innerJoin(
 *     crossDb('ArchiveDB', 'orders'),  // Fully typed! ✅
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
 * const table = crossDb('ArchiveDB', 'reporting.sales');
 * // Generates: ArchiveDB.reporting.sales
 * ```
 *
 * @example
 * Default schema (dbo):
 * ```typescript
 * const table = crossDb('MainDB', 'users');
 * // Generates: MainDB.dbo.users (dbo added automatically)
 * ```
 *
 * @example
 * Complex cross-database join with aggregation:
 * ```typescript
 * const report = await db
 *   .selectFrom(crossDb('ArchiveDB', 'orders'))
 *   .innerJoin('customers', 'customers.id', 'ArchiveDB.dbo.orders.customerId')
 *   .select((eb) => [
 *     'customers.name',
 *     eb.fn.count('ArchiveDB.dbo.orders.id').as('orderCount'),
 *   ])
 *   .groupBy('customers.name')
 *   .execute();
 * ```
 */
export function createCrossDbHelper<DBMap extends Record<string, Record<string, any>>>() {
  return function crossDbTable<
    DB extends keyof DBMap & string,
    Table extends keyof DBMap[DB] & string,
  >(database: DB, table: Table): RawBuilder<DBMap[DB][Table]> {
    // If the table name doesn't include a schema (no dot), default to 'dbo'
    if (!table.includes('.')) {
      return sql`${sql.id(database, 'dbo', table)}`;
    }

    return sql`${sql.id(database, table)}`;
  };
}
