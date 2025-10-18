/**
 * Transaction Composition Example
 *
 * Demonstrates composable transactional functions that work standalone
 * OR participate in larger transactions.
 */

import { createConnection, type Transaction, wrapInTransaction } from '@dev-hla/kysely-mssql';
import type { Generated, Kysely } from 'kysely';

interface Database {
  users: {
    id: Generated<number>;
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
    id: Generated<number>;
    from_user_id: number;
    to_user_id: number;
    amount: number;
    created_at: Date;
  };
  audit_logs: {
    id: Generated<number>;
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

// ===== COMPOSABLE FUNCTIONS =====

async function createUser(
  executor: Kysely<Database> | Transaction<Database>,
  params: { name: string; email: string; balance?: number },
) {
  return wrapInTransaction(executor, async (tx) => {
    const user = await tx
      .insertInto('users')
      .values({
        name: params.name,
        email: params.email,
        balance: params.balance ?? 0,
      })
      .returning(['id', 'name', 'email'])
      .executeTakeFirstOrThrow();

    return user;
  });
}

async function createUserProfile(
  executor: Kysely<Database> | Transaction<Database>,
  params: { userId: number; bio: string; avatarUrl?: string },
) {
  return wrapInTransaction(executor, async (tx) => {
    await tx
      .insertInto('user_profiles')
      .values({
        user_id: params.userId,
        bio: params.bio,
        avatar_url: params.avatarUrl ?? null,
      })
      .execute();
  });
}

async function createAuditLog(
  executor: Kysely<Database> | Transaction<Database>,
  params: { entityType: string; entityId: number; action: string },
) {
  return wrapInTransaction(executor, async (tx) => {
    await tx
      .insertInto('audit_logs')
      .values({
        entity_type: params.entityType,
        entity_id: params.entityId,
        action: params.action,
        created_at: new Date(),
      })
      .execute();
  });
}

// ===== EXAMPLE 1: COMPOSED TRANSACTIONS =====

async function example1_ComposedTransactions() {
  await db.transaction().execute(async (tx) => {
    // All operations reuse the same transaction
    const user = await createUser(tx, {
      name: 'Jane Smith',
      email: 'jane@example.com',
      balance: 200,
    });

    await createUserProfile(tx, { userId: user.id, bio: 'Product manager' });

    await createAuditLog(tx, { entityType: 'user', entityId: user.id, action: 'created' });

    console.log(`✓ Created user ${user.name} atomically`);
  });
}

// ===== EXAMPLE 2: COMPLEX BUSINESS LOGIC =====

// Money transfer with balance checks and audit logging
async function transferMoney(
  executor: Kysely<Database> | Transaction<Database>,
  fromUserId: number,
  toUserId: number,
  amount: number,
) {
  return wrapInTransaction(executor, async (tx) => {
    const sender = await tx
      .selectFrom('users')
      .select(['id', 'name', 'balance'])
      .where('id', '=', fromUserId)
      .forUpdate()
      .executeTakeFirstOrThrow();

    if (sender.balance < amount) {
      throw new Error(`Insufficient funds (balance: $${sender.balance})`);
    }

    const receiver = await tx
      .selectFrom('users')
      .select(['id', 'name', 'balance'])
      .where('id', '=', toUserId)
      .forUpdate()
      .executeTakeFirstOrThrow();

    await tx
      .updateTable('users')
      .set({ balance: sender.balance - amount })
      .where('id', '=', fromUserId)
      .execute();

    await tx
      .updateTable('users')
      .set({ balance: receiver.balance + amount })
      .where('id', '=', toUserId)
      .execute();

    const txRecord = await tx
      .insertInto('transactions')
      .values({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        created_at: new Date(),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    return txRecord;
  });
}

async function example2_ComplexBusinessLogic() {
  await db.transaction().execute(async (tx) => {
    const alice = await createUser(tx, {
      name: 'Alice',
      email: 'alice@example.com',
      balance: 1000,
    });
    const bob = await createUser(tx, { name: 'Bob', email: 'bob@example.com', balance: 500 });

    const transfer = await transferMoney(tx, alice.id, bob.id, 250);

    await createAuditLog(tx, {
      entityType: 'transaction',
      entityId: transfer.id,
      action: 'money_transferred',
    });

    console.log('✓ Transferred $250 from Alice to Bob atomically');
  });
}

// ===== EXAMPLE 3: NESTED COMPOSABLE OPERATIONS =====

// High-level operation composing multiple functions
async function onboardUser(
  executor: Kysely<Database> | Transaction<Database>,
  name: string,
  email: string,
  bio: string,
) {
  return wrapInTransaction(executor, async (tx) => {
    const user = await createUser(tx, { name, email, balance: 100 });

    await createUserProfile(tx, { userId: user.id, bio });

    await createAuditLog(tx, { entityType: 'user', entityId: user.id, action: 'onboarded' });

    return user;
  });
}

async function example3_NestedComposableOperations() {
  // Standalone usage
  await onboardUser(db, 'Charlie Brown', 'charlie@example.com', 'Peanuts enthusiast');
  console.log('✓ Onboarded Charlie (standalone)');

  // Composed into larger transaction
  await db.transaction().execute(async (tx) => {
    await onboardUser(tx, 'David Lee', 'david@example.com', 'Engineer');
    await onboardUser(tx, 'Emma Davis', 'emma@example.com', 'Designer');

    console.log('✓ Onboarded David and Emma (batch transaction)');
  });
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  await example1_ComposedTransactions();
  await example2_ComplexBusinessLogic();
  await example3_NestedComposableOperations();

  await db.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
