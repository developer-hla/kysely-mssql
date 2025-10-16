/**
 * Basic Connection Example
 *
 * This example shows the simplest possible usage of @hunter-ashmore/kysely-mssql.
 * Just define your schema and call createConnection() with minimal configuration.
 */

import { createConnection } from '@hunter-ashmore/kysely-mssql';

// 1. Define your database schema
interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    created_at: Date;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
    content: string;
    created_at: Date;
  };
}

// 2. Create connection (all customizations applied automatically!)
const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'example-app', // Required! Shows up in SQL Server monitoring
});

// 3. Use it like normal Kysely
async function main() {
  console.log('Fetching all users...');

  const users = await db.selectFrom('users').selectAll().execute();

  console.log(`Found ${users.length} users:`);
  users.forEach((user) => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  // This query automatically includes caller tracking:
  // SQL: /* caller: main (examples/basic-connection.ts:42) */
  //      SELECT * FROM users

  console.log('\nFetching user by ID...');

  const user = await db.selectFrom('users').selectAll().where('id', '=', 1).executeTakeFirst();

  if (user) {
    console.log(`Found user: ${user.name}`);
  } else {
    console.log('User not found');
  }

  console.log('\nFetching posts with user names...');

  const postsWithUsers = await db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.user_id')
    .select([
      'posts.id',
      'posts.title',
      'posts.content',
      'users.name as author_name',
      'posts.created_at',
    ])
    .orderBy('posts.created_at', 'desc')
    .execute();

  console.log(`Found ${postsWithUsers.length} posts:`);
  postsWithUsers.forEach((post) => {
    console.log(`  - "${post.title}" by ${post.author_name}`);
  });

  // Clean up
  await db.destroy();
  console.log('\nConnection closed.');
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
