# @hunter-ashmore/kysely-mssql

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
- **`crossDbTable`**: Type-safe cross-database joins with automatic schema handling
- **`deduplicateJoins`**: Automatically remove duplicate joins from dynamic queries
- **`buildSearchFilter`**: Multi-column LIKE search with OR logic and wildcard escaping
- **`batchInsert`**: Bulk insert records in batches to avoid SQL Server parameter limits
- **`batchUpdate`**: Bulk update records in batches with single or composite key support

### Smart Logging
Configurable logging with query and error levels. Integrate with your logging framework (pino, winston, etc.).

---

## Installation

```bash
npm install @hunter-ashmore/kysely-mssql kysely tedious tarn
# or
pnpm add @hunter-ashmore/kysely-mssql kysely tedious tarn
# or
yarn add @hunter-ashmore/kysely-mssql kysely tedious tarn
```

**Peer Dependencies** (required):
- `kysely` >= 0.27.0
- `tedious` >= 18.0.0
- `tarn` >= 3.0.0

---

## Quick Start

### Basic Connection

```typescript
import { createConnection } from '@hunter-ashmore/kysely-mssql';

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
} from '@hunter-ashmore/kysely-mssql';

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
import { paginateQuery } from '@hunter-ashmore/kysely-mssql';

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
import { callStoredProcedure } from '@hunter-ashmore/kysely-mssql';

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
import { wrapInTransaction, type Transaction } from '@hunter-ashmore/kysely-mssql';

// Functions can work standalone OR participate in larger transactions
async function createUser(
  params: CreateUserParams,
  tx?: Transaction<Database>
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      return transaction
        .insertInto('users')
        .values(params)
        .returning(['id', 'name'])
        .executeTakeFirstOrThrow();
    },
    previousTransaction: tx, // Reuse existing transaction if provided
  });
}

async function createUserProfile(
  params: CreateProfileParams,
  tx?: Transaction<Database>
) {
  return wrapInTransaction({
    db,
    callback: async (transaction) => {
      return transaction
        .insertInto('user_profiles')
        .values(params)
        .execute();
    },
    previousTransaction: tx,
  });
}

// Usage 1: Standalone (each creates its own transaction)
const user = await createUser({ name: 'John', email: 'john@example.com' });

// Usage 2: Composed (both share one transaction)
await db.transaction().execute(async (tx) => {
  const user = await createUser({ name: 'Jane', email: 'jane@example.com' }, tx);
  await createUserProfile({ userId: user.id, bio: 'Hello!' }, tx);
  // Both operations in same transaction - atomic!
});
```

### 6. Query Hints

Add SQL Server query hints to optimize query execution:

```typescript
import { addQueryHint } from '@hunter-ashmore/kysely-mssql';

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
import { crossDbTable } from '@hunter-ashmore/kysely-mssql';

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

// Query with cross-database join (fully type-safe!)
const results = await db
  .selectFrom('users') // Current database
  .innerJoin(
    crossDbTable<MyDatabases, 'ArchiveDB', 'historical.orders'>(
      'ArchiveDB',
      'historical.orders'
    ),
    'ArchiveDB.historical.orders.userId',
    'users.id'
  )
  .select(['users.name', 'ArchiveDB.historical.orders.archivedAt'])
  .execute();

// Join multiple external databases
const report = await db
  .selectFrom(crossDbTable<MyDatabases, 'ReportingDB', 'analytics.sales'>(
    'ReportingDB',
    'analytics.sales'
  ))
  .innerJoin(
    crossDbTable<MyDatabases, 'ArchiveDB', 'historical.orders'>(
      'ArchiveDB',
      'historical.orders'
    ),
    'ReportingDB.analytics.sales.date',
    'ArchiveDB.historical.orders.archivedAt'
  )
  .selectAll()
  .execute();

// Schema handling: defaults to 'dbo' if not specified
crossDbTable<MyDatabases, 'MainDB', 'users'>('MainDB', 'users');
// Generates: MainDB.dbo.users

crossDbTable<MyDatabases, 'ArchiveDB', 'historical.orders'>('ArchiveDB', 'historical.orders');
// Generates: ArchiveDB.historical.orders
```

**Benefits:**
- Full TypeScript type safety across databases
- Compile-time validation of database and table names
- Automatic schema handling (defaults to 'dbo')
- Proper SQL identifier escaping

### 8. Deduplicate Joins

Prevent duplicate join errors in dynamically constructed queries:

```typescript
import { deduplicateJoins } from '@hunter-ashmore/kysely-mssql';

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
import { buildSearchFilter } from '@hunter-ashmore/kysely-mssql';

// Basic search across multiple columns
const results = await db
  .selectFrom('posts')
  .where(buildSearchFilter(['title', 'content'], searchTerm))
  .selectAll()
  .execute();
// SQL: WHERE (title LIKE '%searchTerm%' OR content LIKE '%searchTerm%')

// Different search modes
const users = await db
  .selectFrom('users')
  .where(buildSearchFilter(['name'], 'John', { mode: 'startsWith' }))
  .selectAll()
  .execute();
// SQL: WHERE name LIKE 'John%'

const emails = await db
  .selectFrom('users')
  .where(buildSearchFilter(['email'], '@gmail.com', { mode: 'endsWith' }))
  .selectAll()
  .execute();
// SQL: WHERE email LIKE '%@gmail.com'

// Conditional search with other filters
let query = db
  .selectFrom('products')
  .where('status', '=', 'active')
  .selectAll();

if (searchTerm) {
  query = query.where(
    buildSearchFilter(['name', 'description', 'sku'], searchTerm)
  );
}

const products = await query.execute();

// With pagination
const query = db
  .selectFrom('posts')
  .where('status', '=', 'published')
  .where(buildSearchFilter(['title', 'content'], searchTerm))
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

Insert large datasets efficiently in batches to avoid SQL Server parameter limits:

```typescript
import { batchInsert } from '@hunter-ashmore/kysely-mssql';

// Basic usage: insert 10,000 products in batches
const products = Array.from({ length: 10000 }, (_, i) => ({
  name: `Product ${i}`,
  price: 10.99,
  sku: `SKU-${i}`,
}));

await batchInsert(db, 'products', products);
// Automatically splits into batches of 1000 (default)
// Executes 10 INSERT statements

// Custom batch size for parameter-heavy records
const largeRecords = [...]; // Records with many columns

await batchInsert(db, 'large_table', largeRecords, { batchSize: 500 });
// Reduces parameter count per query to stay within SQL Server's 2100 limit

// Within a transaction (all batches atomic)
await db.transaction().execute(async (tx) => {
  await batchInsert(tx, 'users', users);
  await batchInsert(tx, 'user_profiles', profiles);

  // All batches succeed or all rollback
});

// With error handling
try {
  await batchInsert(db, 'products', products, { batchSize: 1000 });
  console.log(`Successfully inserted ${products.length} products`);
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    console.error('Some products already exist');
  }
  throw error;
}
```

**Why Use Batching?**

SQL Server has a parameter limit of 2100 per query. A single INSERT with many records and columns can easily exceed this:

```typescript
// Without batching (can fail with large datasets):
// 1000 records × 20 columns = 20,000 parameters (exceeds limit!)
await db.insertInto('products').values(largeArray).execute(); // Error!

// With batching (safe):
// 500 records × 20 columns = 10,000 parameters per batch (safe)
await batchInsert(db, 'products', largeArray, { batchSize: 500 }); // Success!
```

**Performance Benefits:**
- Reduces round-trips vs individual inserts
- Stays within parameter limits automatically
- Optimizes batch size for your data shape
- Works with transaction guarantees

**When to Use:**
- Bulk imports from external sources
- Data migrations
- Batch processing jobs
- Any scenario inserting hundreds or thousands of records

#### Batch Updates

Update large datasets efficiently in batches:

```typescript
import { batchUpdate } from '@hunter-ashmore/kysely-mssql';

// Basic usage: update 5,000 product prices
const updates = [
  { id: 1, price: 19.99, stock: 50 },
  { id: 2, price: 29.99, stock: 30 },
  // ... 5,000 more updates
];

await batchUpdate(db, 'products', updates);
// Automatically batches updates (default: 1000 per batch)
// Each record: UPDATE products SET price=@1, stock=@2 WHERE id=@3

// Custom batch size for performance tuning
await batchUpdate(db, 'users', userUpdates, { batchSize: 500 });

// Custom key field (default is 'id')
const updates = [
  { email: 'user1@example.com', status: 'active' },
  { email: 'user2@example.com', status: 'inactive' },
];

await batchUpdate(db, 'users', updates, { key: 'email' });
// UPDATE users SET status=@1 WHERE email=@2

// Composite keys for multi-column matching
const updates = [
  { userType: 'admin', active: true, permissions: 'full' },
  { userType: 'user', active: true, permissions: 'limited' },
  { userType: 'guest', active: false, permissions: 'read' },
];

await batchUpdate(db, 'user_settings', updates, {
  key: ['userType', 'active']
});
// UPDATE user_settings SET permissions=@1 WHERE userType=@2 AND active=@3

// Within a transaction (all batches atomic)
await db.transaction().execute(async (tx) => {
  await batchUpdate(tx, 'products', productUpdates);
  await batchUpdate(tx, 'inventory', inventoryUpdates);

  // All batches succeed or all rollback
});

// With error handling
try {
  await batchUpdate(db, 'products', updates, { batchSize: 1000 });
  console.log(`Successfully updated ${updates.length} products`);
} catch (error) {
  if (error instanceof ForeignKeyError) {
    console.error('Some updates reference invalid foreign keys');
  }
  throw error;
}
```

**Key Features:**
- Single key field support (default: 'id')
- Composite key support (multiple WHERE conditions)
- Automatic batching to manage query load
- Transaction support for atomic operations
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
import { createConnection } from '@hunter-ashmore/kysely-mssql';

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
// - Batch insert helper included
// - Batch update helper included
// - Sensible defaults for everything
```

---

## API Reference

### `createConnection<DB>(config: ConnectionConfig): Kysely<DB>`

Creates a Kysely database connection with all customizations included.

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

### `wrapInTransaction<DB, T>(options): Promise<T>`

Execute a callback within a transaction (composable).

**Parameters:**
```typescript
{
  db: Kysely<DB>;
  callback: (tx: Transaction<DB>) => Promise<T>;
  previousTransaction?: Transaction<DB>;
}
```

**Returns:** Result of callback function

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

### `crossDbTable<DBMap, DB, Table>(database, table)`

Create a type-safe table reference for cross-database joins.

**Type Parameters:**
- `DBMap` - Type mapping database names to their schemas
- `DB` - Database name (key in DBMap)
- `Table` - Table name (key in database schema)

**Parameters:**
- `database: DB` - The database name
- `table: Table` - The table name (with or without schema)

**Returns:** Kysely SQL identifier for use in queries

**Example:**
```typescript
type MyDatabases = {
  MainDB: MainSchema,
  ArchiveDB: ArchiveSchema,
};

const results = await db
  .selectFrom('users')
  .innerJoin(
    crossDbTable<MyDatabases, 'ArchiveDB', 'orders'>('ArchiveDB', 'orders'),
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

### `buildSearchFilter<DB, TB>(columns, searchTerm, options?)`

Build a multi-column search filter with OR logic and automatic wildcard escaping.

**Type Parameters:**
- `DB` - Database schema type
- `TB` - Table name

**Parameters:**
- `columns: readonly (keyof DB[TB] & string)[]` - Array of column names to search
- `searchTerm: string` - The term to search for
- `options?: SearchFilterOptions` - Optional search configuration

**SearchFilterOptions:**
- `mode?: 'contains' | 'startsWith' | 'endsWith'` - Search mode (default: 'contains')

**Returns:** Expression builder function for use with `.where()`

**Features:**
- Automatically escapes special LIKE characters (%, _, [, ])
- Type-safe column names (compile-time validation)
- OR logic across all specified columns
- Three search modes for different matching patterns

**Example:**
```typescript
// Basic usage
const results = await db
  .selectFrom('posts')
  .where(buildSearchFilter(['title', 'content'], searchTerm))
  .selectAll()
  .execute();

// With startsWith mode
const users = await db
  .selectFrom('users')
  .where(buildSearchFilter(['name'], 'John', { mode: 'startsWith' }))
  .selectAll()
  .execute();

// Conditional application
let query = db.selectFrom('products').selectAll();
if (searchTerm) {
  query = query.where(buildSearchFilter(['name', 'sku'], searchTerm));
}
```

### `batchInsert<DB, TB>(executor, table, values, options?): Promise<void>`

Insert records in batches to avoid SQL Server parameter limits.

**Type Parameters:**
- `DB` - Database schema type
- `TB` - Table name

**Parameters:**
- `executor: Kysely<DB> | Transaction<DB>` - Database or transaction instance
- `table: TB` - Table name to insert into
- `values: readonly Insertable<DB[TB]>[]` - Array of records to insert
- `options?: BatchInsertOptions` - Optional batch configuration

**BatchInsertOptions:**
- `batchSize?: number` - Records per batch (default: 1000)

**Returns:** Promise<void>

**Why Use This:**
SQL Server has a parameter limit of 2100. With many columns or records, you can easily exceed this limit. This function automatically chunks your inserts into safe batches.

**Example:**
```typescript
// Basic usage
const products = Array.from({ length: 10000 }, (_, i) => ({
  name: `Product ${i}`,
  price: 10.99,
}));

await batchInsert(db, 'products', products);
// Executes 10 INSERT statements of 1000 records each

// Custom batch size
await batchInsert(db, 'products', products, { batchSize: 500 });

// Within a transaction
await db.transaction().execute(async (tx) => {
  await batchInsert(tx, 'users', users);
  await batchInsert(tx, 'profiles', profiles);
  // All batches are atomic
});
```

### `batchUpdate<DB, TB>(executor, table, values, options?): Promise<void>`

Update records in batches with single or composite key support.

**Type Parameters:**
- `DB` - Database schema type
- `TB` - Table name

**Parameters:**
- `executor: Kysely<DB> | Transaction<DB>` - Database or transaction instance
- `table: TB` - Table name to update
- `values: readonly Updateable<DB[TB]>[]` - Array of records to update
- `options?: BatchUpdateOptions` - Optional batch configuration

**BatchUpdateOptions:**
- `batchSize?: number` - Records per batch (default: 1000)
- `key?: string | readonly string[]` - Column name(s) for WHERE clause (default: 'id')

**Returns:** Promise<void>

**How It Works:**
Each record must include the key field(s). The function extracts key values for the WHERE clause and uses remaining fields for the SET clause. Supports both single key fields and composite keys for complex matching.

**Example:**
```typescript
// Basic usage (uses 'id' as key)
const updates = [
  { id: 1, price: 19.99, stock: 50 },
  { id: 2, price: 29.99, stock: 30 },
];

await batchUpdate(db, 'products', updates);
// UPDATE products SET price=@1, stock=@2 WHERE id=@3

// Custom single key
await batchUpdate(db, 'users', updates, { key: 'email' });
// UPDATE users SET status=@1 WHERE email=@2

// Composite key
await batchUpdate(db, 'user_settings', updates, {
  key: ['userType', 'active']
});
// UPDATE user_settings SET permissions=@1 WHERE userType=@2 AND active=@3

// Within a transaction
await db.transaction().execute(async (tx) => {
  await batchUpdate(tx, 'products', productUpdates);
  await batchUpdate(tx, 'inventory', inventoryUpdates);
  // All batches are atomic
});
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

## Migration Guide

### From Plain Kysely

Replace your Kysely setup:

**Before:**
```typescript
import { Kysely, MssqlDialect } from 'kysely';
// ... manual dialect configuration

const db = new Kysely<Database>({ dialect });
```

**After:**
```typescript
import { createConnection } from '@hunter-ashmore/kysely-mssql';

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDB',
  user: 'sa',
  password: 'password',
  appName: 'my-app', // Add this!
});
```

### From Custom Request Pattern

If you're using a custom Request class with error mapping:

**Before:**
```typescript
// Custom Request class setup
// Custom error mapper
// Manual dialect configuration
// ... lots of boilerplate

export const database = new Kysely<Database>({ dialect });
```

**After:**
```typescript
import { createConnection } from '@hunter-ashmore/kysely-mssql';

export const database = createConnection<Database>({
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  appName: 'my-api',
  logLevels: ['error'], // Production
});

// All your custom error classes and request handling work automatically!
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
pnpm link --global @hunter-ashmore/kysely-mssql
```

---

## License

MIT

---

## Credits

Created by Hunter Ashmore.

Special thanks to the Kysely team for the excellent query builder foundation.
