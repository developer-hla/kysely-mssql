/**
 * Pagination Example
 *
 * This example demonstrates the paginateQuery utility for building
 * type-safe paginated queries with comprehensive metadata.
 */

import { createConnection, paginateQuery } from '@hunter-ashmore/kysely-mssql';

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

// Example 1: Basic Pagination
async function getUsers(page: number = 1, limit: number = 10) {
  console.log(`\nFetching users (page ${page}, limit ${limit})...`);

  const query = db.selectFrom('users').selectAll().orderBy('created_at', 'desc');

  const result = await paginateQuery(query, { page, limit });

  console.log('Results:');
  console.log(`  Found ${result.data.length} users on this page`);
  console.log(`  Total records: ${result.pagination.totalRecords}`);
  console.log(`  Total pages: ${result.pagination.totalPages}`);
  console.log(`  Has next page: ${result.pagination.hasNextPage}`);
  console.log(`  Has previous page: ${result.pagination.hasPreviousPage}`);

  result.data.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.name} (${user.email})`);
  });

  return result;
}

// Example 2: Pagination with Filtering
async function getActiveUsers(page: number = 1, limit: number = 10) {
  console.log(`\nFetching active users (page ${page}, limit ${limit})...`);

  const query = db
    .selectFrom('users')
    .selectAll()
    .where('is_active', '=', true)
    .orderBy('created_at', 'desc');

  const result = await paginateQuery(query, { page, limit });

  console.log(`Found ${result.pagination.totalRecords} active users`);
  console.log(`Showing page ${page} of ${result.pagination.totalPages}`);

  return result;
}

// Example 3: Pagination with Joins
async function getPostsWithAuthors(page: number = 1, limit: number = 10) {
  console.log(`\nFetching posts with authors (page ${page}, limit ${limit})...`);

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

  const result = await paginateQuery(query, { page, limit });

  console.log(`Found ${result.pagination.totalRecords} posts`);
  result.data.forEach((post, index) => {
    console.log(
      `  ${index + 1}. "${post.title}" by ${post.author_name} (${post.view_count} views)`,
    );
  });

  return result;
}

// Example 4: Pagination with Search
async function searchPosts(searchTerm: string, page: number = 1, limit: number = 10) {
  console.log(`\nSearching posts for "${searchTerm}" (page ${page})...`);

  const query = db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.user_id')
    .select(['posts.id', 'posts.title', 'posts.content', 'users.name as author_name'])
    .where((eb) =>
      eb.or([
        eb('posts.title', 'like', `%${searchTerm}%`),
        eb('posts.content', 'like', `%${searchTerm}%`),
      ]),
    )
    .orderBy('posts.created_at', 'desc');

  const result = await paginateQuery(query, { page, limit });

  if (result.pagination.totalRecords === 0) {
    console.log('No posts found matching your search.');
  } else {
    console.log(`Found ${result.pagination.totalRecords} posts matching "${searchTerm}"`);
    result.data.forEach((post, index) => {
      console.log(`  ${index + 1}. "${post.title}" by ${post.author_name}`);
    });
  }

  return result;
}

// Example 5: Building a Pagination Navigation UI Helper
function buildPaginationUI(result: Awaited<ReturnType<typeof getUsers>>) {
  const { pagination } = result;

  console.log('\nPagination UI:');

  // Build page number array
  const pages: (number | '...')[] = [];

  if (pagination.totalPages <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= pagination.totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Show first, last, current, and neighbors
    pages.push(1);

    if (pagination.pageNumber > 3) {
      pages.push('...');
    }

    for (
      let i = Math.max(2, pagination.pageNumber - 1);
      i <= Math.min(pagination.totalPages - 1, pagination.pageNumber + 1);
      i++
    ) {
      pages.push(i);
    }

    if (pagination.pageNumber < pagination.totalPages - 2) {
      pages.push('...');
    }

    pages.push(pagination.totalPages);
  }

  const uiString = pages
    .map((page) => {
      if (page === '...') return '...';
      return page === pagination.pageNumber ? `[${page}]` : page.toString();
    })
    .join(' ');

  console.log('  Pages:', uiString);
  console.log(
    `  Showing ${(pagination.pageNumber - 1) * pagination.pageSize + 1}-${Math.min(
      pagination.pageNumber * pagination.pageSize,
      pagination.totalRecords,
    )} of ${pagination.totalRecords}`,
  );

  return pages;
}

// Example 6: Iterating Through All Pages
async function getAllUsers() {
  console.log('\nFetching ALL users (iterating through pages)...');

  let allUsers: Database['users'][] = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await paginateQuery(db.selectFrom('users').selectAll().orderBy('id', 'asc'), {
      page: currentPage,
      limit: 50,
    });

    allUsers = allUsers.concat(result.data);
    console.log(
      `  Fetched page ${currentPage}/${result.pagination.totalPages} (${result.data.length} users)`,
    );

    hasMore = result.pagination.hasNextPage;
    currentPage++;
  }

  console.log(`Total users fetched: ${allUsers.length}`);
  return allUsers;
}

// Run examples
async function main() {
  console.log('=== Pagination Examples ===');

  // Example 1: Basic pagination
  const page1 = await getUsers(1, 5);
  buildPaginationUI(page1);

  const page2 = await getUsers(2, 5);
  buildPaginationUI(page2);

  // Example 2: Filtered pagination
  await getActiveUsers(1, 10);

  // Example 3: Pagination with joins
  await getPostsWithAuthors(1, 5);

  // Example 4: Search with pagination
  await searchPosts('typescript', 1, 10);

  // Example 5: Fetch all users across pages
  await getAllUsers();

  console.log('\nAll pagination examples complete!');

  await db.destroy();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
