/**
 * Batch Operations Example
 *
 * Demonstrates high-performance bulk inserts, updates, and upserts.
 * Automatically handles SQL Server parameter limits.
 */

import {
  batchInsert,
  batchUpdate,
  batchUpsert,
  createConnection,
} from '@hunter-ashmore/kysely-mssql';

interface Database {
  products: {
    id: number;
    sku: string;
    name: string;
    price: number;
    stock: number;
    last_synced: Date;
  };
  user_settings: {
    user_id: number;
    setting_key: string;
    value: string;
    updated_at: Date;
  };
  users: {
    id: number;
    name: string;
    email: string;
  };
}

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'batch-operations-example',
});

// ===== EXAMPLE 1: BATCH INSERT =====

async function example1_BulkInsert() {
  const productsToImport = Array.from({ length: 1500 }, (_, i) => ({
    sku: `PROD-${String(i + 1).padStart(6, '0')}`,
    name: `Product ${i + 1}`,
    price: Math.round((10 + Math.random() * 490) * 100) / 100,
    stock: Math.floor(Math.random() * 1000),
    last_synced: new Date(),
  }));

  await batchInsert(db, 'products', productsToImport);
  console.log(`✓ Inserted ${productsToImport.length} products`);
}

// ===== EXAMPLE 2: COMPOSITE KEY UPDATE =====

// Multi-column WHERE clauses for updates
async function example2_CompositeKeyUpdate() {
  // Setup: create users and settings
  await db
    .insertInto('users')
    .values([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ])
    .onConflict((oc) => oc.column('email').doNothing())
    .execute();

  const users = await db.selectFrom('users').select(['id', 'name']).execute();

  const initialSettings = users.flatMap((user) => [
    { user_id: user.id, setting_key: 'theme', value: 'light', updated_at: new Date() },
    { user_id: user.id, setting_key: 'language', value: 'en', updated_at: new Date() },
  ]);

  await batchInsert(db, 'user_settings', initialSettings);

  // Update using composite key [user_id, setting_key]
  const settingsUpdates = [
    { user_id: users[0].id, setting_key: 'theme', value: 'dark', updated_at: new Date() },
    { user_id: users[1].id, setting_key: 'language', value: 'es', updated_at: new Date() },
  ];

  await batchUpdate(db, 'user_settings', settingsUpdates, {
    key: ['user_id', 'setting_key'],
  });

  console.log('✓ Updated settings with composite key');
}

// ===== EXAMPLE 3: COMPOSITE KEY UPSERT =====

// Multi-column matching for upserts (ideal for multi-tenant scenarios)
async function example3_CompositeKeyUpsert() {
  const users = await db.selectFrom('users').select(['id']).execute();

  const settingsSync = users.flatMap((user) => [
    {
      user_id: user.id,
      setting_key: 'theme',
      value: Math.random() > 0.5 ? 'dark' : 'light',
      updated_at: new Date(),
    },
    {
      user_id: user.id,
      setting_key: 'email_frequency',
      value: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
      updated_at: new Date(),
    },
  ]);

  await batchUpsert(db, 'user_settings', settingsSync, {
    key: ['user_id', 'setting_key'],
  });

  console.log(`✓ Upserted ${settingsSync.length} settings with composite key`);
}

// ===== EXAMPLE 4: ATOMIC BATCH OPERATIONS =====

// Combine multiple batch operations in a transaction
async function example4_AtomicBatchOperations() {
  await db.transaction().execute(async (tx) => {
    // Insert new products
    const newProducts = Array.from({ length: 50 }, (_, i) => ({
      sku: `BATCH-${String(i + 1).padStart(4, '0')}`,
      name: `Batch Product ${i + 1}`,
      price: 29.99,
      stock: 100,
      last_synced: new Date(),
    }));

    await batchInsert(tx, 'products', newProducts);

    // Update existing products
    const existingProducts = await tx
      .selectFrom('products')
      .select(['id'])
      .where('sku', 'like', 'PROD-%')
      .limit(20)
      .execute();

    const updates = existingProducts.map((p) => ({
      id: p.id,
      stock: Math.floor(Math.random() * 500),
      last_synced: new Date(),
    }));

    await batchUpdate(tx, 'products', updates);

    // Upsert from sync
    await batchUpsert(tx, 'products', [
      {
        id: 1,
        sku: 'PROD-000001',
        name: 'Synced Product',
        price: 19.99,
        stock: 200,
        last_synced: new Date(),
      },
    ]);

    console.log('✓ Completed atomic batch operations');
  });
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  await example1_BulkInsert();
  await example2_CompositeKeyUpdate();
  await example3_CompositeKeyUpsert();
  await example4_AtomicBatchOperations();

  await db.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
