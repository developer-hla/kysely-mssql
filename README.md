# @dev-hla/kysely-mssql

> Opinionated Kysely wrapper for MS SQL Server with built-in observability, error handling, and utilities.

This package provides a complete, production-ready Kysely setup for SQL Server with opinionated defaults baked in. Instead of manually configuring Kysely, Tedious, connection pooling, error handling, and observability plugins for each project, simply call `createConnection()` and get everything automatically.

## Features

### Query Origin Tracking (Automatic)
Every query includes SQL comments showing which function triggered it:
```sql
/* caller: getUserById (src/services/user.service.ts:42) */
SELECT * FROM users WHERE id = @1
```
This simplifies debugging production issues, analyzing query patterns, and understanding code-to-database relationships.

### Typed Error Handling
SQL Server errors are automatically mapped to TypeScript exception classes:
- `DuplicateKeyError` - Unique constraint violations (2601, 2627)
- `ForeignKeyError` - Foreign key violations (547)
- `DataTooLongError` - String truncation errors (8152)
- `RequiredFieldError` - NOT NULL violations (515)
- `InvalidDataTypeError` - Type conversion errors (245, 8114)
- `TransactionDeadlockError` - Deadlock victim (1205)
- `TransactionConflictError` - Snapshot isolation conflicts (3960, 3961)
- `DatabaseConnectionError` - Connection failures (18456, 4060, etc.)

### Performance Optimizations
- **VarChar Type Override**: Automatically uses `VarChar` instead of `NVarChar` for better performance with ASCII databases
- **Connection Pooling**: Sensible defaults (2-10 connections) with Tarn
- **Configurable Timeouts**: Request timeout (30s default), connection timeout (15s default)

### Utility Functions
- **`paginateQuery`**: Type-safe pagination with metadata
- **`callStoredProcedure`**: Execute stored procedures with typed parameters
- **`wrapInTransaction`**: Composable transaction helper for building transactional functions
- **`addQueryHint`**: Add SQL Server query hints (RECOMPILE, MAXDOP, etc.) to optimize queries
- **`createCrossDbHelper`**: Type-safe cross-database joins with automatic schema handling
- **`deduplicateJoins`**: Automatically remove duplicate joins from dynamic queries
- **`buildSearchFilter`**: Multi-column LIKE search with OR logic and wildcard escaping
- **Batch Operations**: `db.batchInsert()`, `db.batchUpdate()`, `db.batchUpsert()` available on every connection with automatic sizing and transaction safety

### Smart Logging
Configurable logging with query and error levels. Integrate with your logging framework (pino, winston, etc.).

---

## Installation

```bash
npm install @dev-hla/kysely-mssql kysely tedious tarn
# or
pnpm add @dev-hla/kysely-mssql kysely tedious tarn
# or
yarn add @dev-hla/kysely-mssql kysely tedious tarn
```

**Peer Dependencies** (required):
- `kysely` >= 0.27.0
- `tedious` >= 18.0.0
- `tarn` >= 3.0.0

---

## Quick Start

### Basic Connection

```typescript
import { createConnection } from '@dev-hla/kysely-mssql';

// Define your database schema
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
  };
}

// Create connection with all customizations automatically applied
const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'password',
  appName: 'my-app', // Required! Shows up in SQL Server monitoring
});

// Use it like normal Kysely - but with automatic caller tracking!
const users = await db.selectFrom('users').selectAll().execute();
// SQL: /* caller: getUsers */ SELECT * FROM users
```

### With Advanced Configuration

```typescript
const db = createConnection<Database>({
  // Required
  server: 'sql-server.company.com',
  database: 'Production_DB',
  user: 'app_user',
  password: process.env.DB_PASSWORD!,
  appName: 'my-api', // Critical for SQL Server connection tracking!

  // Optional (with sensible defaults)
  port: 1433,
  requestTimeout: 60000, // 60 seconds
  connectTimeout: 15000,
  trustServerCertificate: false, // Use proper SSL in production

  // Connection pooling
  pool: {
    min: 5,
    max: 20,
  },

  // Logging (default: ['error'])
  logLevels: ['query', 'error'], // Log everything in development

  // Query origin tracking (default: true)
  enableQueryOrigin: true,
  projectRoot: '/path/to/project', // Auto-detected if not provided

  // Custom logger (integrate with your logging framework)
  customLogger: (event) => {
    if (event.level === 'query') {
      logger.debug({ sql: event.query.sql }, 'Query executed');
    } else if (event.level === 'error') {
      logger.error({ err: event.error }, 'Query error');
    }
  },
});
```

---

## Important: Automatic Transactions in Batch Operations

All batch operations (`db.batchInsert`, `db.batchUpdate`, `db.batchUpsert`) are **automatically wrapped in transactions** for atomic all-or-nothing behavior.

**What this means:**
- **Data integrity guaranteed** - Failed batches automatically rollback
- **Safe by default** - Production-ready out of the box
- **No extra code needed** - Transactions happen automatically
- **Small overhead** - For single-record operations, use regular `.insertInto()` instead

**Within existing transactions:**
```typescript
await db.transaction().execute(async (tx) => {
  await tx.batchInsert('users', users);           // Reuses transaction
  await tx.batchUpdate('posts', updates, { key: 'id' }); // Same transaction
  await tx.batchUpsert('products', products, { key: 'sku' }); // Same transaction
  // All operations succeed together or all rollback together
});
```

### Transaction Isolation Levels

Transaction isolation levels can be set using `.setIsolationLevel()` before calling `.execute()`. The transaction callback will have batch methods available and will use the specified isolation level:

```typescript
await db.transaction()
  .setIsolationLevel('serializable')
  .execute(async (tx) => {
    // Batch methods available with serializable isolation
    await tx.batchInsert('users', users);
    await tx.batchUpdate('products', updates, { key: 'id' });
  });
```

Default isolation level is READ COMMITTED (SQL Server default).

---

## Core Features

### 1. Query Origin Tracking

Every query automatically includes SQL comments showing the caller:

```typescript
// In src/services/user.service.ts
async function getUserById(id: number) {
  return db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

// SQL executed:
// /* caller: getUserById (src/services/user.service.ts:42) */
// SELECT * FROM users WHERE id = @1
```

**Benefits:**
- See which code triggered each query in SQL Server logs
- Debug production issues faster
- Understand query patterns and hotspaths
- Correlate application behavior with database activity

**Disable it:**
```typescript
const db = createConnection<Database>({
  // ...
  enableQueryOrigin: false, // Disable if needed
});
```

### 2. Typed Error Handling

Catch specific database errors with TypeScript types:

```typescript
import {
  DuplicateKeyError,
  ForeignKeyError,
  DatabaseError,
} from '@dev-hla/kysely-mssql';

async function createUser(email: string, name: string) {
  try {
    return await db
      .insertInto('users')
      .values({ email, name })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();
  } catch (error) {
    if (error instanceof DuplicateKeyError) {
      // User with this email already exists
      throw new Error('Email already registered');
    }

    if (error instanceof ForeignKeyError) {
      // Referenced entity doesn't exist
      throw new Error('Invalid reference');
    }

    if (error instanceof DatabaseError) {
      // Generic database error
      console.error('Database error:', error.requestError);
    }

    throw error; // Unknown error
  }
}
```

**Available Error Classes:**
- `DuplicateKeyError` - Unique/primary key violations
- `ForeignKeyError` - Foreign key constraint violations
- `DataTooLongError` - String/data truncation
- `RequiredFieldError` - NOT NULL constraint violations
- `InvalidDataTypeError` - Type conversion errors
- `TransactionDeadlockError` - Deadlock victim
- `TransactionConflictError` - Snapshot isolation conflicts
- `DatabaseConnectionError` - Connection failures
- `DatabaseError` - Base class for all database errors

### 3. Pagination

Type-safe pagination with metadata:

```typescript
import { paginateQuery } from '@dev-hla/kysely-mssql';

async function getUsers(page: number, limit: number) {
  const query = db
    .selectFrom('users')
    .selectAll()
    .orderBy('created_at', 'desc');

  const result = await paginateQuery(query, { page, limit });

  return result;
  // {
  //   data: User[],
  //   pagination: {
  //     pageNumber: 1,
  //     pageSize: 50,
  //     totalRecords: 250,
  //     totalPages: 5,
  //     hasNextPage: true,
  //     hasPreviousPage: false,
  //   }
  // }
}
```

### 4. Stored Procedures

Execute stored procedures with typed parameters:

```typescript
import { callStoredProcedure } from '@dev-hla/kysely-mssql';

interface ProductResult {
  ProductID: number;
  ProductName: string;
  Price: number;
}

const products = await callStoredProcedure<ProductResult>(
  db,
  'sp_GetProductsByCategory',
  {
    CategoryID: 5,
    Active: true,
    MinPrice: 10.0,
  }
);

// SQL: /* caller: getProducts */
//      EXEC sp_GetProductsByCategory @CategoryID=5, @Active=1, @MinPrice=10.00
```

### 5. Transaction Composition

Build composable transactional functions:

```typescript
import { wrapInTransaction, type Transaction, type Kysely } from '@dev-hla/kysely-mssql';

// Functions can work standalone OR participate in larger transactions
async function createUser(
  executor: Kysely<Database> | Transaction<Database>,
  params: CreateUserParams
) {
  return wrapInTransaction(executor, async (tx) => {
    return tx
      .insertInto('users')
      .values(params)
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();
  });
}

async function createUserProfile(
  executor: Kysely<Database> | Transaction<Database>,
  params: CreateProfileParams
) {
  return wrapInTransaction(executor, async (tx) => {
    return tx
      .insertInto('user_profiles')
      .values(params)
      .execute();
  });
}

// Usage 1: Standalone (creates its own transaction)
const user = await createUser(db, { name: 'John', email: 'john@example.com' });

// Usage 2: Composed (both share one transaction)
await db.transaction().execute(async (tx) => {
  const user = await createUser(tx, { name: 'Jane', email: 'jane@example.com' });
  await createUserProfile(tx, { userId: user.id, bio: 'Hello!' });
  // Both operations in same transaction - atomic!
});
```

### 6. Query Hints

Add SQL Server query hints to optimize query execution:

```typescript
import { addQueryHint } from '@dev-hla/kysely-mssql';

// Force query recompilation (helps with parameter sniffing issues)
const users = await db
  .selectFrom('users')
  .selectAll()
  .where('status', '=', status) // Parameter-sensitive query
  .$call((qb) => addQueryHint(qb, 'RECOMPILE'))
  .execute();

// Limit parallelism to avoid resource contention
const report = await db
  .selectFrom('sales')
  .select(['region', 'total'])
  .where('year', '=', 2024)
  .$call((qb) => addQueryHint(qb, 'MAXDOP 4'))
  .execute();

// Optimize for unknown parameters (better plan stability)
const search = await db
  .selectFrom('products')
  .selectAll()
  .where('name', 'like', `%${searchTerm}%`)
  .$call((qb) => addQueryHint(qb, 'OPTIMIZE FOR UNKNOWN'))
  .execute();

// Multiple hints
const complexQuery = await db
  .selectFrom('orders')
  .innerJoin('customers', 'customers.id', 'orders.customerId')
  .select(['orders.id', 'customers.name'])
  .$call((qb) => addQueryHint(qb, ['MAXDOP 4', 'RECOMPILE']))
  .execute();
```

**Available Query Hints:**
- `'RECOMPILE'` - Force query recompilation on each execution
- `'MAXDOP N'` - Limit maximum degree of parallelism
- `'OPTIMIZE FOR UNKNOWN'` - Use average statistics instead of parameter sniffing
- `'KEEPFIXED PLAN'` - Prevent recompilation due to statistics changes
- `'FAST N'` - Optimize for retrieving first N rows quickly
- `'HASH GROUP'` / `'HASH JOIN'` / `'HASH UNION'` - Force hash algorithm
- `'LOOP JOIN'` - Force nested loops join
- `'MERGE JOIN'` / `'MERGE UNION'` - Force merge algorithm
- `'MAXRECURSION N'` - Set maximum recursion level for CTEs
- `'CONCAT UNION'` - Force concatenation instead of merge
- `'KEEP PLAN'` - Reduce recompilation frequency
- `'ORDER GROUP'` - Process groups in order
- `'ROBUST PLAN'` - Optimize for maximum row counts

### 7. Cross-Database Joins

Perform type-safe joins across databases on the same SQL Server instance:

```typescript
import { createCrossDbHelper } from '@dev-hla/kysely-mssql';

// Define your database schemas
interface MainDB {
  users: { id: number; name: string; email: string };
  orders: { id: number; userId: number; total: number };
}

interface ArchiveDB {
  'historical.orders': { id: number; userId: number; archivedAt: Date };
}

interface ReportingDB {
  'analytics.sales': { date: Date; total: number };
}

// Map database names to schemas
type MyDatabases = {
  MainDB: MainDB;
  ArchiveDB: ArchiveDB;
  ReportingDB: ReportingDB;
};

// Create helper with full type inference
const crossDb = createCrossDbHelper<MyDatabases>();

// Query with cross-database join (fully type-safe!)
const results = await db
  .selectFrom('users') // Current database
  .innerJoin(
    crossDb('ArchiveDB', 'historical.orders'), // Fully inferred! ✅
    'ArchiveDB.historical.orders.userId',
    'users.id'
  )
  .select(['users.name', 'ArchiveDB.historical.orders.archivedAt'])
  .execute();

// Join multiple external databases
const report = await db
  .selectFrom(crossDb('ReportingDB', 'analytics.sales'))
  .innerJoin(
    crossDb('ArchiveDB', 'historical.orders'),
    'ReportingDB.analytics.sales.date',
    'ArchiveDB.historical.orders.archivedAt'
  )
  .selectAll()
  .execute();

// Schema handling: defaults to 'dbo' if not specified
crossDb('MainDB', 'users');
// Generates: MainDB.dbo.users

crossDb('ArchiveDB', 'historical.orders');
// Generates: ArchiveDB.historical.orders
```

**Benefits:**
- Full TypeScript type safety across databases with complete type inference
- Compile-time validation of database and table names
- Automatic schema handling (defaults to 'dbo')
- Proper SQL identifier escaping
- Idiomatic Kysely pattern - no explicit type parameters needed

### 8. Deduplicate Joins

Prevent duplicate join errors in dynamically constructed queries:

```typescript
import { deduplicateJoins } from '@dev-hla/kysely-mssql';

// Problem: Dynamic queries can add duplicate joins
let query = db.selectFrom('plots');

if (includeRegion) {
  query = query.leftJoin('regions', 'regions.code', 'plots.regionCode');
}

if (searchTerm) {
  // Oops! This might also add the regions join
  query = query
    .leftJoin('regions', 'regions.code', 'plots.regionCode')
    .where('regions.name', 'like', `%${searchTerm}%`);
}

// Without deduplication: Database error if both conditions are true!

// Solution: Apply deduplicateJoins at the start
let query = db
  .selectFrom('plots')
  .$call(deduplicateJoins); // Automatically removes duplicate joins

if (includeRegion) {
  query = query.leftJoin('regions', 'regions.code', 'plots.regionCode');
}

if (searchTerm) {
  query = query
    .leftJoin('regions', 'regions.code', 'plots.regionCode') // Duplicate safely removed
    .where('regions.name', 'like', `%${searchTerm}%`);
}

const results = await query.selectAll().execute(); // Works!
```

**Usage Patterns:**

```typescript
// Pattern 1: Using $call (recommended)
const query = db
  .selectFrom('users')
  .$call(deduplicateJoins)
  .leftJoin('posts', 'posts.userId', 'users.id')
  .selectAll();

// Pattern 2: Functional style
const query = deduplicateJoins(
  db
    .selectFrom('users')
    .leftJoin('posts', 'posts.userId', 'users.id')
);

// Pattern 3: With complex query building
function buildPlotQuery(filters: PlotFilters) {
  let query = db
    .selectFrom('plots')
    .$call(deduplicateJoins); // Apply once at the start

  if (filters.includeCooperator) {
    query = query.leftJoin('cooperators', 'cooperators.id', 'plots.cooperatorId');
  }

  if (filters.searchTerm) {
    // Might conditionally add same joins based on search context
    query = addSearchFilters(query, filters.searchTerm);
  }

  return query;
}
```

**When to Use:**
- Building queries with conditional joins
- Search functionality that dynamically adds joins
- Complex filtering with multiple optional join conditions
- Any scenario where the same join might be added more than once

**Behind the Scenes:**
This is a convenience wrapper around Kysely's built-in `DeduplicateJoinsPlugin`. It's applied locally to specific queries rather than globally to avoid edge cases with complex subqueries.

### 9. Search Filtering

Build multi-column search filters with automatic wildcard escaping:

```typescript
import { buildSearchFilter } from '@dev-hla/kysely-mssql';

// Basic search across multiple columns
const results = await db
  .selectFrom('posts')
  .where((eb) => buildSearchFilter(eb, ['title', 'content'], searchTerm))
  .selectAll()
  .execute();
// SQL: WHERE (title LIKE '%searchTerm%' OR content LIKE '%searchTerm%')

// Different search modes
const users = await db
  .selectFrom('users')
  .where((eb) => buildSearchFilter(eb, ['name'], 'John', { mode: 'startsWith' }))
  .selectAll()
  .execute();
// SQL: WHERE name LIKE 'John%'

const emails = await db
  .selectFrom('users')
  .where((eb) => buildSearchFilter(eb, ['email'], '@gmail.com', { mode: 'endsWith' }))
  .selectAll()
  .execute();
// SQL: WHERE email LIKE '%@gmail.com'

// Conditional search with other filters
let query = db
  .selectFrom('products')
  .where('status', '=', 'active')
  .selectAll();

if (searchTerm) {
  query = query.where((eb) =>
    buildSearchFilter(eb, ['name', 'description', 'sku'], searchTerm)
  );
}

const products = await query.execute();

// With pagination
const query = db
  .selectFrom('posts')
  .where('status', '=', 'published')
  .where((eb) => buildSearchFilter(eb, ['title', 'content'], searchTerm))
  .selectAll()
  .orderBy('created_at', 'desc');

const result = await paginateQuery(query, { page: 1, limit: 20 });
```

**Features:**
- Automatically escapes special LIKE characters (%, _, [, ])
- Three search modes: 'contains' (default), 'startsWith', 'endsWith'
- Type-safe column names (compile-time checking)
- Works seamlessly with other WHERE clauses
- OR logic across multiple columns

**When to Use:**
- Search functionality across multiple text columns
- User-facing search features (products, articles, users)
- Filtering with partial matches
- Any scenario requiring flexible text search

### 10. Bulk Operations

Insert, update, and upsert large datasets efficiently with automatic batch sizing and transaction safety.

#### Batch Insert

```typescript
// Basic usage: insert 10,000 products in batches
const products = Array.from({ length: 10000 }, (_, i) => ({
  name: `Product ${i}`,
  price: 10.99,
  sku: `SKU-${i}`,
}));

const result = await db.batchInsert('products', products);
console.log(`Inserted ${result.totalRecords} products in ${result.batchCount} batches`);
// Example output: "Inserted 10000 products in 10 batches"

// Within an existing transaction (all batches atomic)
await db.transaction().execute(async (tx) => {
  const userResult = await tx.batchInsert('users', users);
  const profileResult = await tx.batchInsert('user_profiles', profiles);

  console.log(`Inserted ${userResult.totalRecords} users and ${profileResult.totalRecords} profiles`);
  // All batches succeed or all rollback together
});

// With error handling
try {
  const result = await db.batchInsert('products', products);
  console.log(`Successfully inserted ${result.totalRecords} products`);
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    console.error('Some products already exist');
  }
  throw error;
}
```

**How Automatic Batch Sizing Works:**

The package automatically calculates the optimal batch size based on SQL Server's 2100 parameter limit:

```typescript
// Your record structure determines batch size:
// 2 columns  → 1000 records per batch (2000 parameters)
// 10 columns → 200 records per batch (2000 parameters)
// 50 columns → 40 records per batch (2000 parameters)

// You don't need to think about this - it just works!
```

**Why Use Batching?**

SQL Server has a parameter limit of 2100 per query. A single INSERT can easily exceed this:

```typescript
// Without batching (can fail):
// 1000 records × 20 columns = 20,000 parameters - Exceeds limit!
await db.insertInto('products').values(largeArray).execute(); // Error!

// With batching (safe):
await db.batchInsert('products', largeArray);
// Automatically calculates: floor(2000 / 20) = 100 records per batch
```

**Performance Benefits:**
- Reduces round-trips vs individual inserts (100x-1000x faster)
- Stays within parameter limits automatically
- Optimizes batch size for your data shape
- Automatic transaction safety (all-or-nothing)

**When to Use:**
- Bulk imports from external sources (CSV, API, etc.)
- Data migrations
- Batch processing jobs
- Any scenario inserting hundreds or thousands of records

#### Batch Update

Update large datasets efficiently using SQL Server's MERGE statement:

```typescript
// Basic usage: update 5,000 product prices
const updates = [
  { id: 1, price: 19.99, stock: 50 },
  { id: 2, price: 29.99, stock: 30 },
  // ... 5,000 more updates
];

const result = await db.batchUpdate('products', updates, { key: 'id' });
console.log(`Updated ${result.totalRecords} products in ${result.batchCount} batches`);
// Uses SQL Server MERGE for bulk updates (much faster than individual UPDATEs)

// Custom key field
const updates = [
  { email: 'user1@example.com', status: 'active' },
  { email: 'user2@example.com', status: 'inactive' },
];

await db.batchUpdate('users', updates, { key: 'email' });
// MERGE statement: SET status = source.status WHERE email = source.email

// Composite keys for multi-column matching
const updates = [
  { userType: 'admin', active: true, permissions: 'full' },
  { userType: 'user', active: true, permissions: 'limited' },
  { userType: 'guest', active: false, permissions: 'read' },
];

await db.batchUpdate('user_settings', updates, {
  key: ['userType', 'active']
});
// MERGE with multiple key columns: WHERE userType = source.userType AND active = source.active

// Within a transaction (all batches atomic)
await db.transaction().execute(async (tx) => {
  const productResult = await tx.batchUpdate('products', productUpdates, { key: 'id' });
  const inventoryResult = await tx.batchUpdate('inventory', inventoryUpdates, { key: 'id' });

  console.log(`Updated ${productResult.totalRecords} products and ${inventoryResult.totalRecords} inventory items`);
  // All batches succeed or all rollback together
});

// With error handling
try {
  const result = await db.batchUpdate('products', updates, { key: 'id' });
  console.log(`Successfully updated ${result.totalRecords} products`);
} catch (error) {
  if (error instanceof ForeignKeyError) {
    console.error('Some updates reference invalid foreign keys');
  }
  throw error;
}
```

**Key Features:**
- Uses SQL Server MERGE statement (true bulk operations, not individual UPDATEs)
- Single key field support (must be explicitly specified)
- Composite key support (multiple WHERE conditions)
- Automatic batch sizing based on record structure
- Automatic transaction safety (all-or-nothing)
- Validates that key fields are present in each update object

**When to Use:**
- Bulk price updates or status changes
- Data synchronization from external sources
- Batch processing jobs that modify existing records
- Any scenario updating hundreds or thousands of records

---

## Comparison with Plain Kysely

### Without This Package

```typescript
import { Kysely, MssqlDialect } from 'kysely';
import * as tedious from 'tedious';
import * as tarn from 'tarn';

// Manual setup required
const dialect = new MssqlDialect({
  tarn: {
    ...tarn,
    options: { min: 2, max: 10 },
  },
  tedious: {
    ...tedious,
    connectionFactory: () =>
      new tedious.Connection({
        authentication: {
          options: {
            userName: 'sa',
            password: 'password',
          },
          type: 'default',
        },
        options: {
          database: 'MyDB',
          port: 1433,
          trustServerCertificate: true,
        },
        server: 'localhost',
      }),
  },
});

const db = new Kysely<Database>({ dialect });

// Limitations:
// - No query origin tracking
// - Generic Error objects (no type safety)
// - No VarChar optimization (uses NVarChar by default)
// - No logging by default
// - No pagination helper
// - No stored procedure helper
// - No transaction composition helper
// - No query hints helper
// - No cross-database join helper
// - No deduplicate joins helper
// - No search filter helper
// - No batch insert helper
// - No batch update helper
```

### With This Package

```typescript
import { createConnection } from '@dev-hla/kysely-mssql';

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDB',
  user: 'sa',
  password: 'password',
  appName: 'my-app',
});

// Included features:
// - Automatic query origin tracking
// - Typed error handling (DuplicateKeyError, ForeignKeyError, etc.)
// - VarChar optimization automatically applied
// - Smart logging (configurable)
// - Pagination helper included
// - Stored procedure helper included
// - Transaction composition helper included
// - Query hints helper included
// - Cross-database join helper included
// - Deduplicate joins helper included
// - Search filter helper included
// - Batch operations: db.batchInsert(), db.batchUpdate(), db.batchUpsert()
//   (automatic sizing, transaction safety, returns metadata)
// - Sensible defaults for everything
```

---

## API Reference

### `createConnection<DB>(config: ConnectionConfig): BatchKysely<DB>`

Creates a Kysely database connection with all customizations and batch operation methods included.

**Returns:** `BatchKysely<DB>` - A Kysely instance with additional batch operation methods:
- `db.batchInsert(table, values)` - Bulk insert with automatic sizing
- `db.batchUpdate(table, values, { key })` - Bulk update with MERGE
- `db.batchUpsert(table, values, { key })` - Bulk upsert with MERGE

**Required Parameters:**
- `server: string` - Database server hostname or IP
- `database: string` - Database name
- `user: string` - Database username
- `password: string` - Database password
- `appName: string` - **REQUIRED!** Application name for SQL Server connection tracking

**Optional Parameters:**
- `port?: number` - Server port (default: 1433)
- `requestTimeout?: number` - Request timeout in ms (default: 30000)
- `connectTimeout?: number` - Connection timeout in ms (default: 15000)
- `trustServerCertificate?: boolean` - Trust server certificate (default: true)
- `abortTransactionOnError?: boolean` - Auto-rollback on error (default: false)
- `pool?: { min?: number; max?: number }` - Connection pool size (default: 2-10)
- `logLevels?: LogLevel[]` - Log levels to enable (default: ['error'])
- `projectRoot?: string` - Project root for query origin paths (default: process.cwd())
- `customLogger?: (event: LogEvent) => void` - Custom logger function
- `enableQueryOrigin?: boolean` - Enable query origin tracking (default: true)

### `paginateQuery<DB, TB, O>(query, params?): Promise<PaginationResult<O>>`

Paginate a Kysely query.

**Parameters:**
- `query: SelectQueryBuilder<DB, TB, O>` - The query to paginate
- `params?: { page?: number; limit?: number }` - Pagination parameters (default: page=1, limit=50)

**Returns:**
```typescript
{
  data: O[];
  pagination: {
    pageNumber: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

### `callStoredProcedure<Result>(db, procedureName, params): Promise<Result[]>`

Execute a stored procedure with typed parameters.

**Parameters:**
- `db: Kysely<DB>` - Database instance
- `procedureName: string` - Name of stored procedure
- `params: Record<string, string | number | boolean | Date | null>` - Parameter dictionary

**Returns:** Array of result rows typed as `Result[]`

### `wrapInTransaction<DB, T>(executor, callback): Promise<T>`

Execute a callback within a transaction (composable).

**Parameters:**
- `executor: Kysely<DB> | Transaction<DB>` - Database instance or existing transaction
- `callback: (tx: Transaction<DB>) => Promise<T>` - Function to execute within transaction

**Returns:** Result of callback function

**Behavior:**
- If `executor` is a `Transaction`, reuses it (no new transaction created)
- If `executor` is a `Kysely` instance, creates a new transaction

**Example:**
```typescript
async function transferFunds(
  executor: Kysely<DB> | Transaction<DB>,
  from: string,
  to: string,
  amount: number
) {
  return wrapInTransaction(executor, async (tx) => {
    await tx.updateTable('accounts')
      .set({ balance: sql`balance - ${amount}` })
      .where('id', '=', from)
      .execute();

    await tx.updateTable('accounts')
      .set({ balance: sql`balance + ${amount}` })
      .where('id', '=', to)
      .execute();
  });
}

// Standalone: creates transaction
await transferFunds(db, 'acc1', 'acc2', 100);

// Composed: reuses transaction
await db.transaction().execute(async (tx) => {
  await transferFunds(tx, 'acc1', 'acc2', 100);
  await logTransfer(tx, 'acc1', 'acc2', 100);
});
```

### `addQueryHint<DB, TB, O>(query, hint): SelectQueryBuilder<DB, TB, O>`

Add SQL Server query hints to a SELECT query.

**Parameters:**
- `query: SelectQueryBuilder<DB, TB, O>` - The Kysely SELECT query
- `hint: QueryHint | QueryHint[]` - Single hint or array of hints to apply

**Returns:** The query with OPTION clause appended

**Example:**
```typescript
const users = await db
  .selectFrom('users')
  .selectAll()
  .$call((qb) => addQueryHint(qb, 'RECOMPILE'))
  .execute();

// Multiple hints
const report = await db
  .selectFrom('sales')
  .selectAll()
  .$call((qb) => addQueryHint(qb, ['MAXDOP 4', 'RECOMPILE']))
  .execute();
```

### `createCrossDbHelper<DBMap>()`

Creates a cross-database helper function with full type inference.

**Type Parameters:**
- `DBMap` - Type mapping database names to their schemas

**Returns:** A helper function `(database, table) => RawBuilder` with inferred types

The returned helper function accepts:
- `database: DB` - The database name (inferred from DBMap)
- `table: Table` - The table name (inferred from database schema)

**Example:**
```typescript
type MyDatabases = {
  MainDB: MainSchema,
  ArchiveDB: ArchiveSchema,
};

// Create helper once
const crossDb = createCrossDbHelper<MyDatabases>();

// Use with full type inference - no explicit type parameters!
const results = await db
  .selectFrom('users')
  .innerJoin(
    crossDb('ArchiveDB', 'orders'), // ✅ Fully inferred!
    'ArchiveDB.dbo.orders.userId',
    'users.id'
  )
  .selectAll()
  .execute();
```

### `deduplicateJoins<DB, TB, O>(query): SelectQueryBuilder<DB, TB, O>`

Apply deduplication to prevent duplicate join errors in dynamic queries.

**Parameters:**
- `query: SelectQueryBuilder<DB, TB, O>` - The Kysely SELECT query to deduplicate

**Returns:** The same query with `DeduplicateJoinsPlugin` applied

**Example:**
```typescript
// Using $call (recommended)
const query = db
  .selectFrom('plots')
  .$call(deduplicateJoins)
  .leftJoin('regions', 'regions.code', 'plots.regionCode')
  .leftJoin('regions', 'regions.code', 'plots.regionCode') // Duplicate removed
  .selectAll();

// Functional style
const query = deduplicateJoins(
  db.selectFrom('users').leftJoin('posts', 'posts.userId', 'users.id')
);
```

### `buildSearchFilter<DB, TB>(eb, columns, searchTerm, options?)`

Build a multi-column search filter with OR logic and automatic wildcard escaping.

**Type Parameters:**
- `DB` - Database schema type
- `TB` - Table name

**Parameters:**
- `eb: ExpressionBuilder<DB, TB>` - Kysely expression builder (provided by `.where()` callback)
- `columns: readonly (keyof DB[TB] & string)[]` - Array of column names to search
- `searchTerm: string` - The term to search for
- `options?: SearchFilterOptions` - Optional search configuration

**SearchFilterOptions:**
- `mode?: 'contains' | 'startsWith' | 'endsWith'` - Search mode (default: 'contains')

**Returns:** Expression for use in WHERE clause

**Features:**
- Automatically escapes special LIKE characters (%, _, [, ])
- Type-safe column names (compile-time validation)
- OR logic across all specified columns
- Three search modes for different matching patterns

**Usage Note:** Must be used within a `.where()` callback to access the expression builder

**Example:**
```typescript
// Basic usage
const results = await db
  .selectFrom('posts')
  .where((eb) => buildSearchFilter(eb, ['title', 'content'], searchTerm))
  .selectAll()
  .execute();

// With startsWith mode
const users = await db
  .selectFrom('users')
  .where((eb) => buildSearchFilter(eb, ['name'], 'John', { mode: 'startsWith' }))
  .selectAll()
  .execute();

// Conditional application
let query = db.selectFrom('products').selectAll();
if (searchTerm) {
  query = query.where((eb) => buildSearchFilter(eb, ['name', 'sku'], searchTerm));
}
```

### Batch Operation Methods (on db instance)

All batch operations are available directly on the `BatchKysely<DB>` instance returned from `createConnection()`.

---

### `db.batchInsert<TB>(table, values): Promise<BatchResult>`

Insert records in batches with automatic sizing and transaction safety.

**Parameters:**
- `table: TB` - Table name to insert into
- `values: readonly Insertable<DB[TB]>[]` - Array of records to insert

**Returns:** `Promise<BatchResult>` with metadata:
```typescript
{
  totalRecords: number;  // Total number of records processed
  batchCount: number;    // Number of database round trips
}
```

**Key Features:**
- Automatic batch sizing based on SQL Server's 2100 parameter limit
- Automatic transaction wrapping (all-or-nothing)
- Optimal performance (maximizes records per batch)

**Example:**
```typescript
const result = await db.batchInsert('products', largeProductArray);
console.log(`Inserted ${result.totalRecords} products in ${result.batchCount} batches`);

// Within an existing transaction
await db.transaction().execute(async (tx) => {
  const userResult = await tx.batchInsert('users', users);
  const profileResult = await tx.batchInsert('profiles', profiles);
  console.log(`Inserted ${userResult.totalRecords} users and ${profileResult.totalRecords} profiles`);
});
```

---

### `db.batchUpdate<TB>(table, values, options): Promise<BatchResult>`

Update records in batches using SQL Server's MERGE statement.

**Parameters:**
- `table: TB` - Table name to update
- `values: readonly Updateable<DB[TB]>[]` - Array of records to update
- `options: BatchUpdateOptions` - **Required** configuration with key field(s)

**BatchUpdateOptions:**
- `key: string | readonly string[]` - **Required** column name(s) for WHERE clause (single or composite keys)

**Returns:** `Promise<BatchResult>` with metadata:
```typescript
{
  totalRecords: number;  // Total number of records processed
  batchCount: number;    // Number of database round trips
}
```

**Key Features:**
- Uses SQL Server MERGE statement (true bulk operations, not individual UPDATEs)
- Single and composite key support
- Automatic batch sizing and transaction safety
- Validates key fields are present in each record

**Example:**
```typescript
// Basic usage
const result = await db.batchUpdate('products', updates, { key: 'id' });
console.log(`Updated ${result.totalRecords} products`);

// Custom key field
await db.batchUpdate('users', updates, { key: 'email' });

// Composite keys
await db.batchUpdate('user_settings', updates, {
  key: ['userType', 'active']
});

// Within an existing transaction
await db.transaction().execute(async (tx) => {
  const productResult = await tx.batchUpdate('products', productUpdates, { key: 'id' });
  const inventoryResult = await tx.batchUpdate('inventory', inventoryUpdates, { key: 'id' });
  console.log(`Updated ${productResult.totalRecords} products and ${inventoryResult.totalRecords} inventory items`);
});
```

---

### `db.batchUpsert<TB>(table, values, options): Promise<BatchResult>`

Upsert records in batches using SQL Server's MERGE statement (insert if not exists, update if exists).

**Parameters:**
- `table: TB` - Table name to upsert into
- `values: readonly Insertable<DB[TB]>[]` - Array of records to upsert
- `options: BatchUpsertOptions` - **Required** configuration with key field(s)

**BatchUpsertOptions:**
- `key: string | readonly string[]` - **Required** column name(s) for matching existing records

**Returns:** `Promise<BatchResult>` with metadata

**Key Features:**
- Insert new records or update existing ones in a single operation
- Uses SQL Server MERGE statement
- Automatic batch sizing and transaction safety

**Example:**
```typescript
const result = await db.batchUpsert('products', products, { key: 'sku' });
console.log(`Upserted ${result.totalRecords} products`);
```

---

## Why appName is Required

The `appName` parameter shows up in:
- `sys.dm_exec_sessions` (program_name column)
- SQL Server Activity Monitor
- Query Store
- Profiler traces
- Extended Events

**Good appName examples:**
- `'my-api'` - Main API service
- `'my-worker'` - Background worker service
- `'my-app-production'` - Production environment identifier

This is **critical** for:
- Production debugging (which service is causing load?)
- Performance monitoring (which app has slow queries?)
- Connection tracking (how many connections per service?)
- Incident response (which service triggered the issue?)

---

## How It Works: Batch Methods via Proxy

Batch methods (`batchInsert`, `batchUpdate`, `batchUpsert`) are added to your database connection using JavaScript Proxy. This allows the package to extend Kysely without modifying the original library.

**What this means:**
- **TypeScript sees the methods** - Full autocomplete and type safety in your IDE
- **Runtime has the methods** - They work perfectly at runtime
- **Reflection doesn't show them** - `Object.keys(db)` won't list batch methods (but they exist)

**Why this approach:**
- No fork of Kysely required
- No monkey-patching of prototypes
- Clean separation of concerns
- Kysely can update independently without breaking changes
- Same pattern Kysely itself uses for plugins

**Example:**
```typescript
const db = createConnection<Database>({...});

// TypeScript knows about batch methods:
await db.batchInsert('users', data); // Full type safety

// But reflection doesn't show them:
console.log(Object.keys(db)); // Won't include 'batchInsert'
console.log('batchInsert' in db); // true - method exists

// This is expected and intentional behavior
```

---

## Contributing

This package is open source and contributions are welcome!

**Development Setup:**
```bash
git clone https://github.com/hunter-ashmore/kysely-mssql.git
cd kysely-mssql
pnpm install
pnpm build
```

**Testing Locally:**
```bash
# In kysely-mssql directory
pnpm build
pnpm link --global

# In your project
pnpm link --global @dev-hla/kysely-mssql
```

---

## License

MIT

---

## Credits

Created by Hunter Ashmore.

Special thanks to the Kysely team for the excellent query builder foundation.
