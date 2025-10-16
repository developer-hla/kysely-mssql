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
**Topics:** Pagination, metadata, filtering, search

Complete pagination examples with the `paginateQuery` utility. Shows how to:
- Paginate basic queries
- Paginate with filtering (WHERE clauses)
- Paginate with JOINs
- Paginate search results
- Build pagination UI helpers
- Iterate through all pages
- Handle edge cases (empty results, last page, etc.)

**Good for:** List views, search results, data tables

---

### [with-transactions.ts](./with-transactions.ts)
**Topics:** Transaction composition, atomic operations, rollbacks

Comprehensive transaction examples with the `wrapInTransaction` utility. Shows how to:
- Create composable transactional functions
- Use functions standalone (create own transaction)
- Use functions composed (share existing transaction)
- Handle transaction rollbacks
- Build complex business logic (money transfers)
- Compose multiple operations atomically
- Nest composable operations

**Good for:** Complex business logic, atomic operations, data consistency

---

### [with-stored-procedures.ts](./with-stored-procedures.ts)
**Topics:** Stored procedures, typed parameters, wrapper functions

Complete stored procedure examples with the `callStoredProcedure` utility. Shows how to:
- Execute basic stored procedures
- Pass multiple parameters (strings, numbers, booleans, dates, null)
- Handle different return types (lists, single rows, aggregations)
- Build type-safe wrapper functions
- Handle stored procedure errors

**Good for:** Legacy databases, performance optimization, complex queries

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
```

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

## Stored Procedures (for stored-procedure examples)

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

-- Search users
CREATE PROCEDURE sp_SearchUsers
    @Name VARCHAR(255) = NULL,
    @Email VARCHAR(255) = NULL,
    @Department VARCHAR(100) = NULL
AS
BEGIN
    SELECT id, name, email, department
    FROM users
    WHERE (@Name IS NULL OR name LIKE '%' + @Name + '%')
        AND (@Email IS NULL OR email LIKE '%' + @Email + '%')
        AND (@Department IS NULL OR department = @Department);
END;
GO

-- Get department statistics
CREATE PROCEDURE sp_GetDepartmentStats
    @Department VARCHAR(100)
AS
BEGIN
    SELECT
        department,
        COUNT(*) as total_employees,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary
    FROM users
    WHERE department = @Department
    GROUP BY department;
END;
GO
```

## Tips

- **Start with [basic-connection.ts](./basic-connection.ts)** to understand the fundamentals
- **Read the comments** - each example includes detailed explanations
- **Modify the examples** - change queries, add fields, experiment!
- **Check SQL logs** - Enable `logLevels: ['query', 'error']` to see generated SQL
- **Use TypeScript** - Examples leverage full type safety, use them as templates

## Need Help?

- Read the main [README.md](../README.md) for API documentation
- Check [Kysely documentation](https://kysely.dev/docs/intro) for query builder syntax
- Report issues on GitHub (once published)
