/**
 * Stored Procedures Example
 *
 * This example demonstrates the callStoredProcedure utility for
 * executing SQL Server stored procedures with typed parameters and results.
 */

import { callStoredProcedure, createConnection } from '@hunter-ashmore/kysely-mssql';

interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    department: string;
    salary: number;
    hire_date: Date;
  };
}

const db = createConnection<Database>({
  server: 'localhost',
  database: 'MyDatabase',
  user: 'sa',
  password: 'your-password-here',
  appName: 'stored-procedure-example',
});

// ===== EXAMPLE 1: BASIC STORED PROCEDURE =====

/**
 * Stored procedure: sp_GetUsersByDepartment
 * Parameters: @Department VARCHAR(100)
 * Returns: List of users in the department
 */
interface UserResult {
  id: number;
  name: string;
  email: string;
  department: string;
}

async function example1_BasicStoredProcedure() {
  console.log('\n=== Example 1: Basic Stored Procedure ===\n');

  const users = await callStoredProcedure<UserResult>(db, 'sp_GetUsersByDepartment', {
    Department: 'Engineering',
  });

  console.log(`Found ${users.length} users in Engineering:`);
  users.forEach((user) => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  // SQL executed:
  // /* caller: example1_BasicStoredProcedure */
  // EXEC sp_GetUsersByDepartment @Department='Engineering'
}

// ===== EXAMPLE 2: STORED PROCEDURE WITH MULTIPLE PARAMETERS =====

/**
 * Stored procedure: sp_GetUsersBySalaryRange
 * Parameters:
 *   @MinSalary DECIMAL(10,2)
 *   @MaxSalary DECIMAL(10,2)
 *   @Department VARCHAR(100) (optional)
 * Returns: List of users in salary range
 */
interface SalaryRangeResult {
  id: number;
  name: string;
  department: string;
  salary: number;
}

async function example2_MultipleParameters() {
  console.log('\n=== Example 2: Multiple Parameters ===\n');

  const users = await callStoredProcedure<SalaryRangeResult>(db, 'sp_GetUsersBySalaryRange', {
    MinSalary: 50000,
    MaxSalary: 100000,
    Department: 'Engineering',
  });

  console.log(`Found ${users.length} Engineering users earning $50k-$100k:`);
  users.forEach((user) => {
    console.log(`  - ${user.name}: $${user.salary.toLocaleString()}`);
  });

  // SQL executed:
  // EXEC sp_GetUsersBySalaryRange @MinSalary=50000, @MaxSalary=100000, @Department='Engineering'
}

// ===== EXAMPLE 3: STORED PROCEDURE WITH NULL PARAMETERS =====

/**
 * Stored procedure: sp_SearchUsers
 * Parameters:
 *   @Name VARCHAR(255) (optional)
 *   @Email VARCHAR(255) (optional)
 *   @Department VARCHAR(100) (optional)
 * Returns: List of users matching search criteria
 */
async function example3_NullParameters() {
  console.log('\n=== Example 3: NULL Parameters ===\n');

  // Search by name only (other parameters NULL)
  const results = await callStoredProcedure<UserResult>(db, 'sp_SearchUsers', {
    Name: 'John',
    Email: null, // NULL parameter
    Department: null, // NULL parameter
  });

  console.log(`Found ${results.length} users named "John"`);

  // SQL executed:
  // EXEC sp_SearchUsers @Name='John', @Email=NULL, @Department=NULL
}

// ===== EXAMPLE 4: STORED PROCEDURE WITH DATE PARAMETERS =====

/**
 * Stored procedure: sp_GetUsersHiredBetween
 * Parameters:
 *   @StartDate DATE
 *   @EndDate DATE
 * Returns: List of users hired in date range
 */
interface HireResult {
  id: number;
  name: string;
  hire_date: Date;
  department: string;
}

async function example4_DateParameters() {
  console.log('\n=== Example 4: Date Parameters ===\n');

  const startDate = new Date('2020-01-01');
  const endDate = new Date('2023-12-31');

  const users = await callStoredProcedure<HireResult>(db, 'sp_GetUsersHiredBetween', {
    StartDate: startDate,
    EndDate: endDate,
  });

  console.log(
    `Found ${users.length} users hired between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}:`,
  );
  users.forEach((user) => {
    console.log(
      `  - ${user.name} (${user.department}): hired ${new Date(user.hire_date).toLocaleDateString()}`,
    );
  });

  // SQL executed:
  // EXEC sp_GetUsersHiredBetween @StartDate='2020-01-01', @EndDate='2023-12-31'
}

// ===== EXAMPLE 5: STORED PROCEDURE WITH BOOLEAN PARAMETERS =====

/**
 * Stored procedure: sp_GetUsers
 * Parameters:
 *   @ActiveOnly BIT
 *   @IncludeSalary BIT
 * Returns: List of users (filtered by active status)
 */
interface UserWithSalary {
  id: number;
  name: string;
  email: string;
  salary?: number; // Optional depending on IncludeSalary
}

async function example5_BooleanParameters() {
  console.log('\n=== Example 5: Boolean Parameters ===\n');

  const users = await callStoredProcedure<UserWithSalary>(db, 'sp_GetUsers', {
    ActiveOnly: true, // Boolean converted to BIT (1)
    IncludeSalary: false, // Boolean converted to BIT (0)
  });

  console.log(`Found ${users.length} active users (without salary):`);
  users.forEach((user) => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  // SQL executed:
  // EXEC sp_GetUsers @ActiveOnly=1, @IncludeSalary=0
}

// ===== EXAMPLE 6: AGGREGATION STORED PROCEDURE =====

/**
 * Stored procedure: sp_GetDepartmentStats
 * Parameters: @Department VARCHAR(100)
 * Returns: Department statistics (single row)
 */
interface DepartmentStats {
  department: string;
  total_employees: number;
  avg_salary: number;
  min_salary: number;
  max_salary: number;
}

async function example6_AggregationProcedure() {
  console.log('\n=== Example 6: Aggregation Procedure ===\n');

  const results = await callStoredProcedure<DepartmentStats>(db, 'sp_GetDepartmentStats', {
    Department: 'Engineering',
  });

  // Even though it returns one row, we get an array
  const stats = results[0];

  console.log('Engineering Department Statistics:');
  console.log(`  Total Employees: ${stats.total_employees}`);
  console.log(`  Average Salary: $${stats.avg_salary.toLocaleString()}`);
  console.log(
    `  Salary Range: $${stats.min_salary.toLocaleString()} - $${stats.max_salary.toLocaleString()}`,
  );
}

// ===== EXAMPLE 7: WRAPPER FUNCTIONS =====

/**
 * Build type-safe wrapper functions around stored procedures
 * for better developer experience.
 */

async function getUsersByDepartment(department: string): Promise<UserResult[]> {
  return callStoredProcedure<UserResult>(db, 'sp_GetUsersByDepartment', { Department: department });
}

async function getUsersBySalaryRange(
  minSalary: number,
  maxSalary: number,
  department?: string,
): Promise<SalaryRangeResult[]> {
  return callStoredProcedure<SalaryRangeResult>(db, 'sp_GetUsersBySalaryRange', {
    MinSalary: minSalary,
    MaxSalary: maxSalary,
    Department: department ?? null,
  });
}

async function example7_WrapperFunctions() {
  console.log('\n=== Example 7: Wrapper Functions ===\n');

  console.log('Using type-safe wrapper functions:\n');

  // Clean, typed API
  const engineers = await getUsersByDepartment('Engineering');
  console.log(`Found ${engineers.length} engineers`);

  const highEarners = await getUsersBySalaryRange(80000, 150000, 'Sales');
  console.log(`Found ${highEarners.length} high-earning sales people`);

  // Benefits:
  // Type safety
  // Parameter validation
  // Better IDE autocomplete
  // Easier to test
  // Consistent error handling
}

// ===== EXAMPLE 8: ERROR HANDLING =====

async function example8_ErrorHandling() {
  console.log('\n=== Example 8: Error Handling ===\n');

  try {
    // Call stored procedure that might fail
    await callStoredProcedure<UserResult>(db, 'sp_GetUsersByDepartment', {
      Department: 'NonExistentDepartment',
    });
  } catch (error) {
    console.error('Stored procedure failed:', (error as Error).message);

    // You can still catch typed database errors
    // (DuplicateKeyError, ForeignKeyError, etc.)
  }

  try {
    // Call non-existent stored procedure
    await callStoredProcedure(db, 'sp_DoesNotExist', { Param: 'value' });
  } catch (error) {
    console.error('Procedure not found:', (error as Error).message);
  }
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  console.log('Stored Procedure Examples\n');
  console.log('Note: These examples assume stored procedures exist in your database.');
  console.log('      Create the procedures first, or adapt examples to your schema.\n');

  try {
    await example1_BasicStoredProcedure();
    await example2_MultipleParameters();
    await example3_NullParameters();
    await example4_DateParameters();
    await example5_BooleanParameters();
    await example6_AggregationProcedure();
    await example7_WrapperFunctions();
    await example8_ErrorHandling();

    console.log('\nAll stored procedure examples complete!');
  } catch (error) {
    console.error('\nExamples failed because stored procedures do not exist.');
    console.error('   Create the procedures in your database first.\n');
    console.error('Error:', (error as Error).message);
  }

  await db.destroy();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
