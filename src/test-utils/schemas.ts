/**
 * Common database schemas for testing.
 *
 * These provide realistic, generic table definitions that can be used across
 * multiple test files. Tests with specific requirements can still define their
 * own schemas.
 */

/**
 * Standard test database schema with common tables.
 * Suitable for most generic database operation tests.
 */
export interface TestDatabase {
  users: {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: Date;
    updatedAt: Date;
  };

  posts: {
    id: number;
    userId: number;
    title: string;
    content: string;
    published: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  orders: {
    id: number;
    userId: number;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    total: number;
    createdAt: Date;
    updatedAt: Date;
  };

  products: {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  order_items: {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    price: number;
  };
}

/**
 * Minimal test database for simple tests that only need basic tables.
 */
export interface MinimalTestDatabase {
  users: {
    id: number;
    name: string;
    email: string;
  };

  posts: {
    id: number;
    userId: number;
    title: string;
  };
}
