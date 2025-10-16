import type { LogEvent } from 'kysely';
import type { LogLevel } from '../logging/index.js';

/**
 * Configuration options for creating a Kysely connection to SQL Server.
 */
export interface ConnectionConfig {
  // ===== REQUIRED =====

  /**
   * Database server hostname or IP address.
   * @example 'localhost' or 'sql-server.company.com'
   */
  server: string;

  /**
   * Database name to connect to.
   * @example 'MyDatabase' or 'Production_DB'
   */
  database: string;

  /**
   * Database username for authentication.
   */
  user: string;

  /**
   * Database password for authentication.
   */
  password: string;

  /**
   * Application name for SQL Server connection tracking.
   *
   * IMPORTANT: This shows up in:
   * - sys.dm_exec_sessions (program_name column)
   * - SQL Server Activity Monitor
   * - Query Store
   * - Profiler traces
   *
   * Use descriptive names to identify the source of queries:
   * - 'my-api' for main API service
   * - 'my-worker' for background workers
   * - 'my-app-production' for production environment
   *
   * This is critical for production debugging and monitoring.
   *
   * @example 'my-api'
   * @example 'my-worker'
   * @example 'my-app-production'
   */
  appName: string;

  // ===== OPTIONAL (with sensible defaults) =====

  /**
   * Server port number.
   * @default 1433
   */
  port?: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  requestTimeout?: number;

  /**
   * Connection timeout in milliseconds.
   * @default 15000 (15 seconds)
   */
  connectTimeout?: number;

  /**
   * Whether to trust the server certificate (for SSL/TLS).
   * Set to false in production with proper certificates.
   * @default true
   */
  trustServerCertificate?: boolean;

  /**
   * Whether to automatically rollback transactions on error.
   * @default false
   */
  abortTransactionOnError?: boolean;

  /**
   * Connection pool configuration.
   */
  pool?: {
    /**
     * Minimum number of connections in the pool.
     * @default 2
     */
    min?: number;
    /**
     * Maximum number of connections in the pool.
     * @default 10
     */
    max?: number;
  };

  /**
   * Which log levels to enable.
   *
   * - 'query': Log all SQL queries (useful for development)
   * - 'error': Log only errors (recommended for production)
   *
   * @default ['error']
   * @example ['query', 'error'] // Log everything (development)
   * @example ['error'] // Log only errors (production)
   */
  logLevels?: LogLevel[];

  /**
   * Project root directory for relative path resolution in query origin comments.
   *
   * If not provided, uses process.cwd().
   *
   * @example '/Users/me/my-project'
   * @example '/var/www/app'
   */
  projectRoot?: string;

  /**
   * Custom logger function to replace the default console-based logger.
   *
   * Use this to integrate with your application's logging framework
   * (pino, winston, etc.).
   *
   * @example
   * ```typescript
   * import pino from 'pino';
   * const logger = pino();
   *
   * const db = createConnection({
   *   // ... other config
   *   customLogger: (event) => {
   *     if (event.level === 'query') {
   *       logger.debug({ sql: event.query.sql }, 'Query executed');
   *     } else if (event.level === 'error') {
   *       logger.error({ err: event.error }, 'Query error');
   *     }
   *   }
   * });
   * ```
   */
  customLogger?: (event: LogEvent) => void;

  /**
   * Whether to enable the QueryOriginPlugin.
   *
   * When enabled, all queries include SQL comments showing which function
   * triggered them (e.g., `/\* caller: getUserById *\/`).
   *
   * Disable this only if you have performance concerns or don't want
   * caller tracking in SQL logs.
   *
   * @default true
   */
  enableQueryOrigin?: boolean;
}
