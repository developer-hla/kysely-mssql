/**
 * Query Optimization Example
 *
 * Demonstrates SQL Server-specific optimization features:
 * query hints, cross-database queries, and duplicate join prevention.
 */

import { addQueryHint, createConnection, deduplicateJoins } from '@dev-hla/kysely-mssql';

interface MainDatabase {
  users: {
    id: number;
    name: string;
    department: string;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
    view_count: number;
  };
  regions: {
    code: string;
    name: string;
    country: string;
  };
  plots: {
    id: number;
    name: string;
    region_code: string;
  };
}

const db = createConnection<MainDatabase>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'query-optimization-example',
});

// ===== EXAMPLE 1: RECOMPILE HINT =====

// Force fresh execution plan for parameter-sensitive queries
async function example1_RecompileHint() {
  const searchDepartment = 'Engineering'; // Could be 'Executive' with very different row counts

  const users = await db
    .selectFrom('users')
    .selectAll()
    .where('department', '=', searchDepartment)
    .$call((qb) => addQueryHint(qb, 'RECOMPILE'))
    .execute();

  console.log(`✓ Found ${users.length} users with RECOMPILE hint`);
}

// ===== EXAMPLE 2: MAXDOP HINT =====

// Control parallelism (MAXDOP 1 = no parallelism, useful for OLTP queries)
async function example2_MaxdopHint() {
  // Fast lookup - no parallelism overhead
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', 1)
    .$call((qb) => addQueryHint(qb, 'MAXDOP 1'))
    .executeTakeFirst();

  console.log(`✓ Found user: ${user?.name}`);

  // Large aggregation - use multiple cores
  const stats = await db
    .selectFrom('posts')
    .select((eb) => [
      eb.fn.count<number>('id').as('total_posts'),
      eb.fn.sum<number>('view_count').as('total_views'),
    ])
    .$call((qb) => addQueryHint(qb, 'MAXDOP 4'))
    .executeTakeFirstOrThrow();

  console.log(`✓ Aggregated ${stats.total_posts} posts with MAXDOP 4`);
}

// ===== EXAMPLE 3: MULTIPLE HINTS =====

// Combine hints for precise control
async function example3_MultipleHints() {
  const report = await db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.user_id')
    .select((eb) => [
      'users.department',
      eb.fn.count<number>('posts.id').as('post_count'),
      eb.fn.sum<number>('posts.view_count').as('total_views'),
    ])
    .groupBy('users.department')
    .$call((qb) => addQueryHint(qb, ['MAXDOP 4', 'RECOMPILE']))
    .execute();

  console.log(`✓ Generated report with multiple hints: ${report.length} departments`);
}

// ===== EXAMPLE 4: DEDUPLICATE JOINS =====

// Prevent duplicate joins when building queries dynamically
async function example4_DeduplicateJoins() {
  // deduplicateJoins() removes duplicate join clauses automatically.
  // This is useful when building complex queries with multiple conditional branches
  // that might add the same join more than once.
  const results = await db
    .selectFrom('plots')
    .$call(deduplicateJoins)
    .leftJoin('regions', 'regions.code', 'plots.region_code')
    .leftJoin('regions', 'regions.code', 'plots.region_code') // Duplicate - removed
    .where('regions.country', '=', 'USA')
    .leftJoin('regions', 'regions.code', 'plots.region_code') // Another duplicate - removed
    .where('regions.name', 'like', '%Plot%')
    .select(['plots.id', 'plots.name', 'regions.name as region_name', 'regions.country'])
    .execute();

  console.log(`✓ Found ${results.length} plots (duplicate joins removed automatically)`);
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  await example1_RecompileHint();
  await example2_MaxdopHint();
  await example3_MultipleHints();
  await example4_DeduplicateJoins();

  await db.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
