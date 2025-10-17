# Examples

This directory contains comprehensive examples demonstrating all features of `@hunter-ashmore/kysely-mssql`.

## Running Examples

**Prerequisites:**
1. Install dependencies in the kysely-mssql package:
   ```bash
   pnpm install
   pnpm build
   ```

2. Set up a local SQL Server instance with test database

3. Update connection details in each example file:
   ```typescript
   const db = createConnection<Database>({
     server: 'localhost',        // ← Your server
     database: 'MyDatabase',     // ← Your database
     user: 'sa',                 // ← Your username
     password: 'your-password',  // ← Your password
     appName: 'example-app',
   });
   ```

4. Run an example:
   ```bash
   # If using tsx (recommended for development)
   npx tsx examples/basic-connection.ts

   # Or compile and run
   pnpm build
   node dist/examples/basic-connection.js
   ```

## Example Files

### [basic-connection.ts](./basic-connection.ts)
**Topics:** Connection setup, basic queries, automatic caller tracking

The simplest possible usage. Shows how to:
- Define your database schema
- Create a connection with minimal configuration
- Execute basic SELECT queries
- Use JOINs and WHERE clauses
- See automatic query origin tracking in action

**Good for:** First-time users, understanding the basics

---

### [error-handling.ts](./error-handling.ts)
**Topics:** Typed errors, constraint violations, transaction errors

Demonstrates typed error handling with specific SQL Server error classes. Shows how to:
- Catch `DuplicateKeyError` (unique constraint violations)
- Catch `ForeignKeyError` (foreign key violations)
- Catch `DataTooLongError` (string truncation)
- Catch `RequiredFieldError` (NOT NULL violations)
- Catch `TransactionDeadlockError` (deadlocks)
- Handle errors gracefully with TypeScript type guards
- Access underlying Tedious `RequestError` for detailed info

**Good for:** Production applications, robust error handling

---

### [with-pagination.ts](./with-pagination.ts)
**Topics:** Pagination, metadata, search

Focused pagination examples with the `paginateQuery` utility. Shows how to:
- Paginate basic queries
- Paginate with JOINs
- Paginate search results with `buildSearchFilter`

**Good for:** List views, search results, data tables

---

### [with-transactions.ts](./with-transactions.ts)
**Topics:** Transaction composition, atomic operations

Transaction examples with the `wrapInTransaction` utility. Shows how to:
- Create composable transactional functions
- Build complex business logic (money transfers with balance checks)
- Compose multiple operations atomically
- Nest composable operations for reusability

**Good for:** Complex business logic, atomic operations, data consistency

---

### [with-stored-procedures.ts](./with-stored-procedures.ts)
**Topics:** Stored procedures, typed parameters, wrapper functions

Stored procedure examples with the `callStoredProcedure` utility. Shows how to:
- Execute basic stored procedures
- Pass multiple parameters
- Build type-safe wrapper functions (best practice)

**Good for:** Legacy databases, performance optimization, complex queries

---

### [batch-operations.ts](./batch-operations.ts)
**Topics:** Batch inserts, updates, upserts, composite keys

High-performance bulk operations with the `batchInsert`, `batchUpdate`, and `batchUpsert` utilities. Shows how to:
- Insert 1000+ records efficiently (automatic batching)
- Update with composite keys (multi-column WHERE clauses)
- Upsert with composite keys (multi-tenant scenarios)
- Combine batch operations in transactions

**Good for:** Data imports, API syncs, bulk updates, high-throughput applications

---

### [query-optimization.ts](./query-optimization.ts)
**Topics:** Query hints, join deduplication

SQL Server-specific optimization features. Shows how to:
- Use query hints (RECOMPILE, MAXDOP)
- Control parallelism and query plan caching
- Prevent duplicate joins in dynamic queries
- Combine multiple hints

**Good for:** Performance tuning, dynamic query building

---

## Database Schema

Most examples assume the following basic schema:

```sql
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(100),
    salary DECIMAL(10,2),
    balance DECIMAL(10,2) DEFAULT 0,
    is_active BIT DEFAULT 1,
    hire_date DATE,
    created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE user_profiles (
    user_id INT PRIMARY KEY,
    bio VARCHAR(MAX),
    avatar_url VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE posts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content VARCHAR(MAX),
    view_count INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- For batch-operations.ts examples
CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    last_synced DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE user_settings (
    user_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    value VARCHAR(MAX),
    updated_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (user_id, setting_key),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- For query-optimization.ts examples
CREATE TABLE regions (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL
);

CREATE TABLE plots (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region_code VARCHAR(10),
    FOREIGN KEY (region_code) REFERENCES regions(code)
);
```

### Sample Data

You can create this schema by running:

```sql
-- Run the CREATE TABLE statements above
-- Then populate with sample data:

INSERT INTO users (name, email, department, salary, balance, hire_date)
VALUES
    ('John Doe', 'john@example.com', 'Engineering', 85000, 100, '2020-03-15'),
    ('Jane Smith', 'jane@example.com', 'Engineering', 92000, 200, '2019-07-22'),
    ('Bob Wilson', 'bob@example.com', 'Sales', 75000, 150, '2021-01-10'),
    ('Alice Johnson', 'alice@example.com', 'Marketing', 68000, 75, '2022-05-18');
```

## Required Stored Procedures

The [with-stored-procedures.ts](./with-stored-procedures.ts) example references several stored procedures. Create them:

```sql
-- Get users by department
CREATE PROCEDURE sp_GetUsersByDepartment
    @Department VARCHAR(100)
AS
BEGIN
    SELECT id, name, email, department
    FROM users
    WHERE department = @Department;
END;
GO

-- Get users by salary range
CREATE PROCEDURE sp_GetUsersBySalaryRange
    @MinSalary DECIMAL(10,2),
    @MaxSalary DECIMAL(10,2),
    @Department VARCHAR(100) = NULL
AS
BEGIN
    SELECT id, name, department, salary
    FROM users
    WHERE salary BETWEEN @MinSalary AND @MaxSalary
        AND (@Department IS NULL OR department = @Department);
END;
GO
```
