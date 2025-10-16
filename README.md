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
