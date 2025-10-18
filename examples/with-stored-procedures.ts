/**
 * Stored Procedures Example
 *
 * Demonstrates executing SQL Server stored procedures with typed parameters.
 */

import { callStoredProcedure, createConnection } from '@dev-hla/kysely-mssql';

interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    department: string;
    salary: number;
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

interface UserResult extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  department: string;
}

async function example1_BasicStoredProcedure() {
  const users = await callStoredProcedure<Database, UserResult>(db, 'sp_GetUsersByDepartment', {
    Department: 'Engineering',
  });

  console.log(`✓ Found ${users.length} users in Engineering`);
}

// ===== EXAMPLE 2: MULTIPLE PARAMETERS =====

interface SalaryRangeResult extends Record<string, unknown> {
  id: number;
  name: string;
  department: string;
  salary: number;
}

async function example2_MultipleParameters() {
  const users = await callStoredProcedure<Database, SalaryRangeResult>(
    db,
    'sp_GetUsersBySalaryRange',
    {
      MinSalary: 50000,
      MaxSalary: 100000,
      Department: 'Engineering', // Optional parameter
    },
  );

  console.log(`✓ Found ${users.length} users earning $50k-$100k`);
}

// ===== EXAMPLE 3: WRAPPER FUNCTIONS =====

// Build type-safe wrappers for better developer experience
async function getUsersByDepartment(department: string): Promise<UserResult[]> {
  return callStoredProcedure<Database, UserResult>(db, 'sp_GetUsersByDepartment', {
    Department: department,
  });
}

async function getUsersBySalaryRange(
  minSalary: number,
  maxSalary: number,
  department?: string,
): Promise<SalaryRangeResult[]> {
  return callStoredProcedure<Database, SalaryRangeResult>(db, 'sp_GetUsersBySalaryRange', {
    MinSalary: minSalary,
    MaxSalary: maxSalary,
    Department: department ?? null,
  });
}

async function example3_WrapperFunctions() {
  const engineers = await getUsersByDepartment('Engineering');
  console.log(`✓ Found ${engineers.length} engineers via wrapper`);

  const highEarners = await getUsersBySalaryRange(80000, 150000, 'Sales');
  console.log(`✓ Found ${highEarners.length} high-earning sales people via wrapper`);
}

// ===== RUN ALL EXAMPLES =====

async function main() {
  await example1_BasicStoredProcedure();
  await example2_MultipleParameters();
  await example3_WrapperFunctions();

  await db.destroy();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
