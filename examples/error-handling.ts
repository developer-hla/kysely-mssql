/**
 * Error Handling Example
 *
 * This example demonstrates typed error handling with specific SQL Server error classes.
 * Instead of catching generic Error objects, you can catch and handle specific database
 * errors with full type safety.
 */

import {
  createConnection,
  DatabaseError,
  DataTooLongError,
  DuplicateKeyError,
  ForeignKeyError,
  RequiredFieldError,
} from '@dev-hla/kysely-mssql';
import type { Generated } from 'kysely';

interface Database {
  users: {
    id: Generated<number>;
    email: string; // UNIQUE constraint
    name: string; // NOT NULL constraint
    bio: string; // VARCHAR(255) - can truncate
  };
  posts: {
    id: Generated<number>;
    user_id: number; // FOREIGN KEY to users(id)
    title: string;
    content: string;
  };
}

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'error-handling-example',
});

// Example 1: Handling Duplicate Key Errors
async function createUser(email: string, name: string) {
  try {
    const user = await db
      .insertInto('users')
      .values({ email, name, bio: '' })
      .returning(['id', 'email', 'name'])
      .executeTakeFirstOrThrow();

    console.log('User created:', user);
    return user;
  } catch (error) {
    if (error instanceof DuplicateKeyError) {
      // Unique constraint violation (email already exists)
      console.error('Email already registered:', email);
      console.error('   SQL Error:', error.requestError.number);
      console.error('   Constraint:', error.requestError.message);
      throw new Error('A user with this email already exists');
    }

    if (error instanceof RequiredFieldError) {
      // NOT NULL constraint violation
      console.error('Missing required field');
      throw new Error('Name is required');
    }

    throw error; // Re-throw unknown errors
  }
}

// Example 2: Handling Foreign Key Errors
async function createPost(userId: number, title: string, content: string) {
  try {
    const post = await db
      .insertInto('posts')
      .values({ user_id: userId, title, content })
      .returning(['id', 'title'])
      .executeTakeFirstOrThrow();

    console.log('Post created:', post);
    return post;
  } catch (error) {
    if (error instanceof ForeignKeyError) {
      // Foreign key constraint violation (user doesn't exist)
      console.error('User does not exist:', userId);
      console.error('   SQL Error:', error.requestError.number);
      throw new Error('Invalid user ID');
    }

    throw error;
  }
}

// Example 3: Handling Data Truncation Errors
async function updateUserBio(userId: number, bio: string) {
  try {
    await db.updateTable('users').set({ bio }).where('id', '=', userId).execute();

    console.log('Bio updated for user', userId);
  } catch (error) {
    if (error instanceof DataTooLongError) {
      // String truncation error (bio too long for VARCHAR(255))
      console.error('Bio is too long:', bio.length, 'characters');
      console.error('   Maximum allowed: 255 characters');
      throw new Error('Bio must be 255 characters or less');
    }

    throw error;
  }
}

// Example 4: Comprehensive Error Handling
async function safeCreateUser(email: string, name: string) {
  try {
    return await createUser(email, name);
  } catch (error) {
    // All database errors extend DatabaseError
    if (error instanceof DatabaseError) {
      console.error('Database error occurred:');
      console.error('  Error class:', error.constructor.name);
      console.error('  SQL Server error number:', error.requestError.number);
      console.error('  Message:', error.requestError.message);

      // Access the underlying Tedious RequestError for more details
      if (error.requestError.lineNumber) {
        console.error('  Line number:', error.requestError.lineNumber);
      }
      if (error.requestError.procName) {
        console.error('  Procedure:', error.requestError.procName);
      }

      return null; // Graceful failure
    }

    // Non-database error
    console.error('Unexpected error:', error);
    throw error;
  }
}

// Run examples
async function main() {
  console.log('=== Error Handling Examples ===\n');

  console.log('1. Creating first user (should succeed)...');
  await safeCreateUser('john@example.com', 'John Doe');

  console.log('\n2. Creating duplicate user (should fail with DuplicateKeyError)...');
  await safeCreateUser('john@example.com', 'Jane Doe');

  console.log('\n3. Creating post with invalid user (should fail with ForeignKeyError)...');
  try {
    await createPost(99999, 'Test Post', 'This user does not exist');
  } catch (error) {
    console.error('Caught error:', (error as Error).message);
  }

  console.log('\n4. Updating bio with too-long string (should fail with DataTooLongError)...');
  const longBio = 'A'.repeat(300); // Exceeds VARCHAR(255)
  try {
    await updateUserBio(1, longBio);
  } catch (error) {
    console.error('Caught error:', (error as Error).message);
  }

  console.log('\n5. All examples complete!');

  await db.destroy();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
