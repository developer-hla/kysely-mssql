/**
 * Pagination Example
 *
 * Demonstrates the paginateQuery utility for building
 * type-safe paginated queries with comprehensive metadata.
 */

import { buildSearchFilter, createConnection, paginateQuery } from '@hunter-ashmore/kysely-mssql';

interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    created_at: Date;
    is_active: boolean;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
    content: string;
    view_count: number;
    created_at: Date;
  };
}

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'pagination-example',
});

// ===== EXAMPLE 1: BASIC PAGINATION =====

async function example1_BasicPagination() {
  const query = db.selectFrom('users').selectAll().orderBy('created_at', 'desc');

  const result = await paginateQuery(query, { page: 1, limit: 10 });

  console.log(
    `✓ Found ${result.pagination.totalRecords} users (page 1/${result.pagination.totalPages})`,
  );
}

// ===== EXAMPLE 2: PAGINATION WITH JOINS =====

async function example2_PaginationWithJoins() {
  const query = db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.user_id')
    .select([
      'posts.id',
      'posts.title',
      'posts.content',
      'posts.view_count',
      'posts.created_at',
      'users.name as author_name',
      'users.email as author_email',
    ])
    .orderBy('posts.created_at', 'desc');

  const result = await paginateQuery(query, { page: 1, limit: 10 });

  console.log(`✓ Found ${result.pagination.totalRecords} posts with authors`);
}

// ===== EXAMPLE 3: PAGINATION WITH SEARCH =====

async function example3_PaginationWithSearch() {
  const searchTerm = 'typescript';

  const query = db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.user_id')
    .select(['posts.id', 'posts.title', 'posts.content', 'users.name as author_name'])
    .where(buildSearchFilter(['posts.title', 'posts.content'], searchTerm))
    .orderBy('posts.created_at', 'desc');

  const result = await paginateQuery(query, { page: 1, limit: 10 });

  console.log(`✓ Found ${result.pagination.totalRecords} posts matching "${searchTerm}"`);
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  await example1_BasicPagination();
  await example2_PaginationWithJoins();
  await example3_PaginationWithSearch();

  await db.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
