/**
 * SQL Server error numbers for testing error mapping.
 */
export const SQL_SERVER_ERROR_NUMBERS = {
  FOREIGN_KEY_VIOLATION: 547,
  DUPLICATE_KEY_INDEX: 2601,
  DUPLICATE_KEY_CONSTRAINT: 2627,
  STRING_TRUNCATION: 8152,
  NULL_VIOLATION: 515,
  CONVERSION_FAILED: 245,
  DATA_TRUNCATED: 2628,
  DEADLOCK: 1205,
  SNAPSHOT_CONFLICT: 3960,
  CANNOT_OPEN_DATABASE: 4060,
  LOGIN_FAILED: 18456,
  UNKNOWN_ERROR: 99999,
} as const;

/**
 * Sample SQL queries for testing.
 */
export const SAMPLE_QUERIES = {
  SELECT: 'SELECT * FROM users WHERE id = @1',
  INSERT: 'INSERT INTO users (name, email) VALUES (@1, @2)',
  UPDATE: 'UPDATE users SET name = @1 WHERE id = @2',
  DELETE: 'DELETE FROM users WHERE id = @1',
  STORED_PROC: 'EXEC sp_GetUserById @UserId=1',
} as const;

/**
 * Sample pagination test cases.
 */
export const PAGINATION_TEST_CASES = {
  EMPTY_RESULTS: {
    totalRecords: 0,
    page: 1,
    limit: 50,
    expected: {
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  SINGLE_PAGE: {
    totalRecords: 25,
    page: 1,
    limit: 50,
    expected: {
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  FIRST_PAGE: {
    totalRecords: 150,
    page: 1,
    limit: 50,
    expected: {
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  },
  MIDDLE_PAGE: {
    totalRecords: 150,
    page: 2,
    limit: 50,
    expected: {
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    },
  },
  LAST_PAGE: {
    totalRecords: 150,
    page: 3,
    limit: 50,
    expected: {
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    },
  },
} as const;

/**
 * Sample stack traces for QueryOriginPlugin testing.
 */
export const SAMPLE_STACK_TRACES = {
  WITH_FUNCTION_NAME: `Error
    at getUserById (/project/src/services/user.service.ts:42:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,

  ANONYMOUS_FUNCTION: `Error
    at /project/src/services/user.service.ts:42:15
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,

  NESTED_CALLS: `Error
    at getUserById (/project/src/services/user.service.ts:42:15)
    at fetchUserData (/project/src/controllers/user.controller.ts:23:10)
    at handleRequest (/project/src/routes/users.ts:15:5)`,

  NODE_MODULES: `Error
    at Object.<anonymous> (/project/node_modules/kysely/dist/index.js:100:5)
    at getUserById (/project/src/services/user.service.ts:42:15)`,
} as const;
