import type { AliasedRawBuilder, Insertable, Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';

/**
 * Options for configuring batch upsert behavior.
 */
export interface BatchUpsertOptions<K extends string = string> {
  /**
   * Number of records to upsert per batch.
   *
   * SQL Server has parameter limits (2100 parameters) and performance
   * considerations. A smaller batch size reduces parameter count per query
   * but increases the number of queries. A larger batch size reduces queries
   * but may hit parameter limits.
   *
   * @default 1000
   */
  batchSize?: number;

  /**
   * The column name(s) to use as the unique identifier for matching records.
   *
   * These fields must be present in each upsert object and will be used in
   * the MERGE ON clause to identify which records to update vs insert.
   *
   * Can be a single column name or an array of column names for composite keys.
   *
   * @default 'id'
   */
  key?: K | readonly K[];
}

/**
 * Helper function to create a VALUES table constructor for use in MERGE USING clause.
 * Transforms an array of records into a SQL VALUES expression with column aliases.
 *
 * @example
 * ```typescript
 * const data = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' }
 * ];
 * const source = createValuesSource(data, 'source');
 * // SQL: (VALUES (1, 'Alice'), (2, 'Bob')) AS source(id, name)
 * ```
 */
function createValuesSource<R extends Record<string, unknown>, A extends string>(
  records: R[],
  alias: A,
): AliasedRawBuilder<R, A> {
  const keys = Object.keys(records[0]);

  // Build VALUES rows: (val1, val2), (val3, val4), ...
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

  // Build column aliases: source(col1, col2, col3)
  const wrappedAlias = sql.ref(alias);
  const wrappedColumns = sql.join(keys.map(sql.ref), sql`, `);
  const aliasSql = sql`${wrappedAlias}(${wrappedColumns})`;

  return sql<R>`(VALUES ${valueRows})`.as<A>(aliasSql);
}

/**
 * Upserts (insert or update) records in batches using SQL Server's MERGE statement.
 *
 * For each record, if a matching row exists (based on key fields), it updates the row.
 * If no match exists, it inserts a new row. This is an atomic operation per batch.
 *
 * The function uses SQL Server's MERGE statement with a derived table source,
 * which provides optimal performance for bulk upsert operations.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to upsert into
 * @param values - Array of records to upsert (must include key field(s))
 * @param options - Optional configuration
 *
 * @example
 * Basic usage with default id key:
 * ```typescript
 * const products = [
 *   { id: 1, name: 'Product 1', price: 19.99 },
 *   { id: 2, name: 'Product 2', price: 29.99 },
 *   { id: 999, name: 'New Product', price: 39.99 }
 * ];
 *
 * await batchUpsert(db, 'products', products);
 * // Updates products 1 and 2 if they exist, inserts product 999
 * ```
 *
 * @example
 * With custom key field:
 * ```typescript
 * const users = [
 *   { email: 'alice@example.com', name: 'Alice Updated', role: 'admin' },
 *   { email: 'bob@example.com', name: 'Bob', role: 'user' },
 * ];
 *
 * await batchUpsert(db, 'users', users, { key: 'email' });
 * // Matches on email: updates Alice if exists, inserts Bob if new
 * ```
 *
 * @example
 * With composite key (multiple matching fields):
 * ```typescript
 * const settings = [
 *   { userId: 1, settingKey: 'theme', value: 'dark' },
 *   { userId: 1, settingKey: 'language', value: 'en' },
 *   { userId: 2, settingKey: 'theme', value: 'light' },
 * ];
 *
 * await batchUpsert(db, 'user_settings', settings, {
 *   key: ['userId', 'settingKey']
 * });
 * // Matches on (userId, settingKey) combination
 * // MERGE ON target.userId = source.userId AND target.settingKey = source.settingKey
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   // Upsert products
 *   await batchUpsert(tx, 'products', productUpdates);
 *
 *   // Upsert inventory
 *   await batchUpsert(tx, 'inventory', inventoryUpdates);
 *
 *   // All upserts are atomic within the transaction
 * });
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * try {
 *   await batchUpsert(db, 'products', products, { batchSize: 500 });
 *   console.log(`Successfully upserted ${products.length} products`);
 * } catch (error) {
 *   if (error instanceof ForeignKeyError) {
 *     console.error('Some products reference invalid categories');
 *   }
 *   throw error;
 * }
 * ```
 *
 * @example
 * Syncing data from external API:
 * ```typescript
 * // External API returns full dataset
 * const apiData = await fetchProductsFromAPI();
 *
 * // Map to database schema
 * const products = apiData.map(p => ({
 *   externalId: p.id,
 *   name: p.name,
 *   price: p.price,
 *   lastSynced: new Date()
 * }));
 *
 * // Upsert all - updates existing, inserts new
 * await batchUpsert(db, 'products', products, {
 *   key: 'externalId',
 *   batchSize: 1000
 * });
 * ```
 */
export async function batchUpsert<
  DB,
  TB extends keyof DB & string,
  K extends keyof DB[TB] & string = Extract<keyof DB[TB] & string, 'id'>,
>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Insertable<DB[TB]>[],
  options?: BatchUpsertOptions<K>,
): Promise<void> {
  // Handle empty array
  if (values.length === 0) {
    return;
  }

  const batchSize = options?.batchSize ?? 1000;
  const keyOption = (options?.key ?? 'id') as K | readonly K[];
  const keys = (Array.isArray(keyOption) ? keyOption : [keyOption]) as readonly K[];

  // Process in batches
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const typedBatch = batch as Record<string, unknown>[];

    // Validate all key fields are present in all records
    for (const record of typedBatch) {
      for (const key of keys) {
        const keyValue = record[key];
        if (keyValue === undefined) {
          throw new Error(`Key field '${key}' is missing in upsert object`);
        }
      }
    }

    // Get all column names from the first record
    const allColumns = Object.keys(typedBatch[0]) as (keyof DB[TB] & string)[];

    // Separate key columns from non-key columns for UPDATE clause
    const updateColumns = allColumns.filter((col) => !keys.includes(col as K));

    // Create VALUES source: (VALUES (1, 'Alice'), (2, 'Bob')) AS source(id, name)
    const valuesSource = createValuesSource(typedBatch, 'source');

    // Build ON condition for MERGE
    // Note: Using `as any` here is necessary because Kysely's MERGE types don't support
    // dynamic VALUES-based sources at compile time. The function signature ensures
    // user-facing type safety (K extends keyof DB[TB]), while these internal casts
    // handle the runtime VALUES source construction.
    if (keys.length === 1) {
      const key = keys[0];

      await executor
        .mergeInto(table)
        .using(valuesSource as any, `source.${key}` as any, `${table}.${key}` as any)
        .whenMatched()
        .thenUpdateSet((eb: any) => {
          const updates: Partial<Record<string, unknown>> = {};
          for (const col of updateColumns) {
            updates[col] = eb.ref(`source.${col}`);
          }
          return updates as any;
        })
        .whenNotMatched()
        .thenInsertValues((eb: any) => {
          const inserts: Partial<Record<string, unknown>> = {};
          for (const col of allColumns) {
            inserts[col] = eb.ref(`source.${col}`);
          }
          return inserts as any;
        })
        .execute();
    } else {
      // Composite key: use expression builder with AND conditions
      await executor
        .mergeInto(table)
        .using(valuesSource as any, (eb: any) => {
          const conditions = keys.map((key) => eb(`source.${key}`, '=', eb.ref(`${table}.${key}`)));
          return eb.and(conditions);
        })
        .whenMatched()
        .thenUpdateSet((eb: any) => {
          const updates: Partial<Record<string, unknown>> = {};
          for (const col of updateColumns) {
            updates[col] = eb.ref(`source.${col}`);
          }
          return updates as any;
        })
        .whenNotMatched()
        .thenInsertValues((eb: any) => {
          const inserts: Partial<Record<string, unknown>> = {};
          for (const col of allColumns) {
            inserts[col] = eb.ref(`source.${col}`);
          }
          return inserts as any;
        })
        .execute();
    }
  }
}
