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

/**
 * Sample data generators for common test scenarios.
 */
export const SAMPLE_DATA = {
  /**
   * Creates a sample user record with optional overrides.
   */
  user: (overrides?: {
    id?: number;
    name?: string;
    email?: string;
    status?: 'active' | 'inactive' | 'suspended';
  }) => ({
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    status: 'active' as const,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  /**
   * Creates a sample post record with optional overrides.
   */
  post: (overrides?: {
    id?: number;
    userId?: number;
    title?: string;
    content?: string;
    published?: boolean;
  }) => ({
    id: 1,
    userId: 1,
    title: 'Test Post',
    content: 'This is a test post content.',
    published: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  /**
   * Creates a sample order record with optional overrides.
   */
  order: (overrides?: {
    id?: number;
    userId?: number;
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
    total?: number;
  }) => ({
    id: 1,
    userId: 1,
    status: 'completed' as const,
    total: 99.99,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),

  /**
   * Creates a sample product record with optional overrides.
   */
  product: (overrides?: {
    id?: number;
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
    active?: boolean;
  }) => ({
    id: 1,
    name: 'Test Product',
    description: 'A test product for testing.',
    price: 29.99,
    stock: 100,
    active: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }),
} as const;
