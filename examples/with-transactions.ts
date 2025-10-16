/**
 * Transaction Composition Example
 *
 * This example demonstrates the wrapInTransaction utility for building
 * composable transactional functions. Functions can work standalone
 * (creating their own transactions) OR participate in larger transactions.
 */

import {
  createConnection,
  type Transaction,
  wrapInTransaction,
} from '@hunter-ashmore/kysely-mssql';

interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    balance: number;
  };
  user_profiles: {
    user_id: number;
    bio: string;
    avatar_url: string | null;
  };
  transactions: {
    id: number;
    from_user_id: number;
    to_user_id: number;
    amount: number;
    created_at: Date;
  };
  audit_logs: {
    id: number;
    entity_type: string;
    entity_id: number;
    action: string;
    created_at: Date;
  };
}

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'transaction-example',
});

// ===== COMPOSABLE TRANSACTION FUNCTIONS =====

/**
 * Creates a user. Can work standalone OR within an existing transaction.
 */
async function createUser(
  params: { name: string; email: string; balance?: number },
  tx?: Transaction<Database>,
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      console.log(`  Creating user: ${params.name}`);

      const user = await transaction
        .insertInto('users')
        .values({
          name: params.name,
          email: params.email,
          balance: params.balance ?? 0,
        })
        .returning(['id', 'name', 'email'])
        .executeTakeFirstOrThrow();

      console.log(`  User created: ${user.name} (ID: ${user.id})`);
      return user;
    },
    previousTransaction: tx, // Reuse tx if provided, otherwise create new
  });
}

/**
 * Creates a user profile. Can work standalone OR within an existing transaction.
 */
async function createUserProfile(
  params: { userId: number; bio: string; avatarUrl?: string },
  tx?: Transaction<Database>,
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      console.log(`  Creating profile for user ${params.userId}`);

      await transaction
        .insertInto('user_profiles')
        .values({
          user_id: params.userId,
          bio: params.bio,
          avatar_url: params.avatarUrl ?? null,
        })
        .execute();

      console.log(`  Profile created for user ${params.userId}`);
    },
    previousTransaction: tx,
  });
}

/**
 * Creates an audit log entry. Can work standalone OR within an existing transaction.
 */
async function createAuditLog(
  params: { entityType: string; entityId: number; action: string },
  tx?: Transaction<Database>,
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      await transaction
        .insertInto('audit_logs')
        .values({
          entity_type: params.entityType,
          entity_id: params.entityId,
          action: params.action,
          created_at: new Date(),
        })
        .execute();

      console.log(`  Audit log: ${params.action} on ${params.entityType}`);
    },
    previousTransaction: tx,
  });
}

// ===== EXAMPLE 1: STANDALONE USAGE =====

async function example1_StandaloneUsage() {
  console.log('\n=== Example 1: Standalone Usage ===');
  console.log('Each function creates its own transaction:\n');

  // Each call creates its own transaction
  const user = await createUser({
    name: 'John Doe',
    email: 'john@example.com',
    balance: 100,
  });

  await createUserProfile({
    userId: user.id,
    bio: 'Software developer',
    avatarUrl: 'https://example.com/avatar.jpg',
  });

  await createAuditLog({
    entityType: 'user',
    entityId: user.id,
    action: 'created',
  });

  console.log('\nAll operations completed (3 separate transactions)');
}

// ===== EXAMPLE 2: COMPOSED TRANSACTIONS =====

async function example2_ComposedTransactions() {
  console.log('\n=== Example 2: Composed Transactions ===');
  console.log('All operations in ONE transaction (atomic):\n');

  await db.transaction().execute(async (tx) => {
    console.log('Starting atomic transaction...');

    // All these calls reuse the same transaction
    const user = await createUser(
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        balance: 200,
      },
      tx,
    );

    await createUserProfile(
      {
        userId: user.id,
        bio: 'Product manager',
      },
      tx,
    );

    await createAuditLog(
      {
        entityType: 'user',
        entityId: user.id,
        action: 'created',
      },
      tx,
    );

    console.log('\nCommitting transaction...');
  });

  console.log('All operations completed (1 atomic transaction)');
}

// ===== EXAMPLE 3: TRANSACTION ROLLBACK =====

async function example3_TransactionRollback() {
  console.log('\n=== Example 3: Transaction Rollback ===');
  console.log('Transaction fails and rolls back everything:\n');

  try {
    await db.transaction().execute(async (tx) => {
      console.log('Starting transaction...');

      const user = await createUser(
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
        },
        tx,
      );

      await createUserProfile(
        {
          userId: user.id,
          bio: 'Designer',
        },
        tx,
      );

      // Simulate an error - this will cause the transaction to rollback
      console.log('  Simulating error...');
      throw new Error('Something went wrong!');
    });
  } catch (error) {
    console.log(`\nTransaction rolled back: ${(error as Error).message}`);
    console.log('   User and profile were NOT created');
  }
}

// ===== EXAMPLE 4: COMPLEX BUSINESS LOGIC =====

/**
 * Transfer money between users (complex transactional operation).
 */
async function transferMoney(
  fromUserId: number,
  toUserId: number,
  amount: number,
  tx?: Transaction<Database>,
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      console.log(`  Transferring $${amount} from user ${fromUserId} to ${toUserId}`);

      // Get sender's balance
      const sender = await transaction
        .selectFrom('users')
        .select(['id', 'name', 'balance'])
        .where('id', '=', fromUserId)
        .forUpdate() // Lock the row
        .executeTakeFirstOrThrow();

      if (sender.balance < amount) {
        throw new Error(`Insufficient funds (balance: $${sender.balance})`);
      }

      // Get receiver
      const receiver = await transaction
        .selectFrom('users')
        .select(['id', 'name', 'balance'])
        .where('id', '=', toUserId)
        .forUpdate() // Lock the row
        .executeTakeFirstOrThrow();

      // Deduct from sender
      await transaction
        .updateTable('users')
        .set({ balance: sender.balance - amount })
        .where('id', '=', fromUserId)
        .execute();

      // Add to receiver
      await transaction
        .updateTable('users')
        .set({ balance: receiver.balance + amount })
        .where('id', '=', toUserId)
        .execute();

      // Record transaction
      const txRecord = await transaction
        .insertInto('transactions')
        .values({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount,
          created_at: new Date(),
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      console.log(`  Transfer complete (transaction ID: ${txRecord.id})`);
      console.log(`     ${sender.name}: $${sender.balance} → $${sender.balance - amount}`);
      console.log(`     ${receiver.name}: $${receiver.balance} → $${receiver.balance + amount}`);

      return txRecord;
    },
    previousTransaction: tx,
  });
}

async function example4_ComplexBusinessLogic() {
  console.log('\n=== Example 4: Complex Business Logic ===');
  console.log('Money transfer with audit logging (atomic):\n');

  await db.transaction().execute(async (tx) => {
    console.log('Starting transfer transaction...');

    // Create two users
    const alice = await createUser(
      { name: 'Alice', email: 'alice@example.com', balance: 1000 },
      tx,
    );
    const bob = await createUser({ name: 'Bob', email: 'bob@example.com', balance: 500 }, tx);

    // Transfer money (composable!)
    const transfer = await transferMoney(alice.id, bob.id, 250, tx);

    // Log the transfer (composable!)
    await createAuditLog(
      {
        entityType: 'transaction',
        entityId: transfer.id,
        action: 'money_transferred',
      },
      tx,
    );

    console.log('\nCommitting transaction...');
  });

  console.log('Transfer and audit log completed atomically');
}

// ===== EXAMPLE 5: NESTED COMPOSABLE OPERATIONS =====

/**
 * High-level operation that composes multiple transactional functions.
 */
async function onboardUser(name: string, email: string, bio: string, tx?: Transaction<Database>) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      console.log(`\n  Onboarding user: ${name}`);

      // Create user (composable)
      const user = await createUser({ name, email, balance: 100 }, transaction);

      // Create profile (composable)
      await createUserProfile({ userId: user.id, bio }, transaction);

      // Log onboarding (composable)
      await createAuditLog(
        {
          entityType: 'user',
          entityId: user.id,
          action: 'onboarded',
        },
        transaction,
      );

      console.log(`  User onboarded: ${user.name}`);
      return user;
    },
    previousTransaction: tx,
  });
}

async function example5_NestedComposableOperations() {
  console.log('\n=== Example 5: Nested Composable Operations ===');
  console.log('High-level operation composes multiple functions:\n');

  // Can be called standalone
  await onboardUser('Charlie Brown', 'charlie@example.com', 'Peanuts enthusiast');

  console.log('\n---\n');

  // OR composed into larger transaction
  await db.transaction().execute(async (tx) => {
    console.log('Onboarding multiple users atomically...');

    await onboardUser('David Lee', 'david@example.com', 'Engineer', tx);
    await onboardUser('Emma Davis', 'emma@example.com', 'Designer', tx);

    console.log('\nCommitting batch onboarding...');
  });

  console.log('All users onboarded');
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  console.log('Transaction Composition Examples\n');

  await example1_StandaloneUsage();
  await example2_ComposedTransactions();
  await example3_TransactionRollback();
  await example4_ComplexBusinessLogic();
  await example5_NestedComposableOperations();

  console.log('\nAll transaction examples complete!');

  await db.destroy();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
