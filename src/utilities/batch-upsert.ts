import type { AliasedRawBuilder, Insertable, Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';

/**
 * Options for configuring batch upsert behavior.
 */
export interface BatchUpsertOptions<K extends string = string> {
  /**
   * Number of records to upsert per batch.
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
   * **Required** - no assumptions are made about your schema structure.
   */
  key: K | readonly K[];
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
 * Upserts (insert or update) records in batches using SQL Server's MERGE statement.
 *
 * For each record, if a matching row exists (based on key fields), it updates the row.
 * If no match exists, it inserts a new row. Uses SQL Server's MERGE statement for
 * optimal bulk upsert performance.
 *
 * @param executor - Kysely database instance or transaction
 * @param table - Table name to upsert into
 * @param values - Array of records to upsert (must include key field(s)). **Empty array is a no-op** (returns immediately).
 * @param options - Configuration including **required** `key` field
 *
 * @throws {Error} When a key field is missing from an upsert object
 * @throws {Error} Propagates any database errors from the MERGE operation
 *
 * @remarks
 * **Edge Cases:**
 * - Empty array: Returns immediately without executing any queries
 * - Single record: Executes a single MERGE statement
 * - Missing key field: Throws error immediately when detected during validation
 *
 * **Key field is required** - no assumptions are made about your schema structure.
 * Explicitly specify which field(s) uniquely identify records.
 *
 * @example
 * Basic usage with explicit key:
 * ```typescript
 * await batchUpsert(db, 'products', [
 *   { id: 1, name: 'Product 1', price: 19.99 },
 *   { id: 999, name: 'New Product', price: 39.99 }
 * ], { key: 'id' });
 * // Updates product 1 if exists, inserts product 999
 * ```
 *
 * @example
 * Composite key for multi-column matching:
 * ```typescript
 * await batchUpsert(db, 'user_settings', settings, {
 *   key: ['userId', 'settingKey']
 * });
 * // MERGE ON target.userId = source.userId AND target.settingKey = source.settingKey
 * ```
 *
 * @example
 * Within a transaction:
 * ```typescript
 * await db.transaction().execute(async (tx) => {
 *   await batchUpsert(tx, 'products', productUpdates, { key: 'productId' });
 *   await batchUpsert(tx, 'inventory', inventoryUpdates, { key: 'sku' });
 * });
 * ```
 */
export async function batchUpsert<
  DB,
  TB extends keyof DB & string,
  K extends keyof DB[TB] & string,
>(
  executor: Kysely<DB> | Transaction<DB>,
  table: TB,
  values: readonly Insertable<DB[TB]>[],
  options: BatchUpsertOptions<K>,
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const batchSize = options.batchSize ?? 1000;
  const keyOption = options.key;
  const keys = (Array.isArray(keyOption) ? keyOption : [keyOption]) as readonly K[];

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const typedBatch = batch as Record<string, unknown>[];

    typedBatch.forEach((record, recordIndex) => {
      for (const key of keys) {
        const keyValue = record[key];
        if (keyValue === undefined) {
          const absoluteIndex = i + recordIndex;
          throw new Error(
            `Key field '${key}' is missing in upsert object at index ${absoluteIndex}. Record: ${JSON.stringify(record).slice(0, 200)}`,
          );
        }
      }
    });

    const allColumns = Object.keys(typedBatch[0]) as (keyof DB[TB] & string)[];
    const updateColumns = allColumns.filter((col) => !keys.includes(col as K));
    const valuesSource = createValuesSource(typedBatch, 'source');

    if (keys.length === 1) {
      const key = keys[0];

      await executor
        .mergeInto(table)
        // Type assertion required: Kysely's MERGE types don't support dynamic table references from VALUES
        .using(valuesSource as any, `source.${key}` as any, `${table}.${key}` as any)
        .whenMatched()
        // Type assertion required: Dynamic column references in UPDATE SET clause
        .thenUpdateSet((eb: any) => {
          const updates: Partial<Record<string, unknown>> = {};
          for (const col of updateColumns) {
            updates[col] = eb.ref(`source.${col}`);
          }
          return updates as any;
        })
        .whenNotMatched()
        // Type assertion required: Dynamic column references in INSERT VALUES clause
        .thenInsertValues((eb: any) => {
          const inserts: Partial<Record<string, unknown>> = {};
          for (const col of allColumns) {
            inserts[col] = eb.ref(`source.${col}`);
          }
          return inserts as any;
        })
        .execute();
    } else {
      await executor
        .mergeInto(table)
        // Type assertion required: Kysely's MERGE types don't support dynamic table references from VALUES
        .using(valuesSource as any, (eb: any) => {
          const conditions = keys.map((key) => eb(`source.${key}`, '=', eb.ref(`${table}.${key}`)));
          return eb.and(conditions);
        })
        .whenMatched()
        // Type assertion required: Dynamic column references in UPDATE SET clause
        .thenUpdateSet((eb: any) => {
          const updates: Partial<Record<string, unknown>> = {};
          for (const col of updateColumns) {
            updates[col] = eb.ref(`source.${col}`);
          }
          return updates as any;
        })
        .whenNotMatched()
        // Type assertion required: Dynamic column references in INSERT VALUES clause
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
