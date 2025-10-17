import type { Dialect } from 'kysely';
import { Kysely, MssqlDialect } from 'kysely';
import tarn from 'tarn';
import * as tedious from 'tedious';

import { createLogger } from '../logging/index.js';
import { createQueryOriginPlugin } from '../plugins/index.js';
import { Request, TEDIOUS_TYPE_UNICODE_OVERWRITES } from '../tedious/index.js';
import type { ConnectionConfig } from './types.js';

/**
 * Creates a Kysely database connection with opinionated defaults.
 *
 * This function sets up a complete Kysely instance with:
 * - QueryOriginPlugin for automatic caller tracking in SQL comments
 * - Custom Request class with typed error mapping
 * - Tedious type overwrites for VarChar performance optimization
 * - Sensible connection pooling defaults
 * - Configurable logging
 *
 * @param config - Connection configuration
 * @returns A fully configured Kysely database instance
 *
 * @example
 * Basic usage:
 * ```typescript
 * interface Database {
 *   users: {
 *     id: number;
 *     name: string;
 *     email: string;
 *   };
 * }
 *
 * const db = createConnection<Database>({
 *   server: 'localhost',
 *   database: 'MyDatabase',
 *   user: 'sa',
 *   password: 'password',
 *   appName: 'my-app', // Required!
 * });
 *
 * // All queries now include caller tracking:
 * const users = await db.selectFrom('users').selectAll().execute();
 * // SQL: /\* caller: getUserList *\/ SELECT * FROM users
 * ```
 *
 * @example
 * With custom configuration:
 * ```typescript
 * const db = createConnection<Database>({
 *   server: 'sql-server.company.com',
 *   database: 'Production_DB',
 *   user: 'app_user',
 *   password: process.env.DB_PASSWORD!,
 *   appName: 'my-api',
 *   port: 1433,
 *   requestTimeout: 60000, // 60 seconds
 *   pool: {
 *     min: 5,
 *     max: 20,
 *   },
 *   logLevels: ['error'], // Production: only log errors
 *   trustServerCertificate: false, // Use proper SSL certificates
 * });
 * ```
 *
 * @example
 * Development setup (verbose logging):
 * ```typescript
 * const db = createConnection<Database>({
 *   server: 'localhost',
 *   database: 'DevDB',
 *   user: 'dev',
 *   password: 'dev',
 *   appName: 'dev-local',
 *   logLevels: ['query', 'error'], // Log everything in development
 * });
 * ```
 */
export function createConnection<DB>(config: ConnectionConfig): Kysely<DB> {
  if (!config.appName) {
    throw new Error(
      'ConnectionConfig.appName is required. ' +
        'Use descriptive names like "my-api", "my-worker", etc. ' +
        'This shows up in SQL Server connection tracking and is critical for debugging.',
    );
  }

  const port = config.port ?? 1433;
  const requestTimeout = config.requestTimeout ?? 30000;
  const connectTimeout = config.connectTimeout ?? 15000;
  const trustServerCertificate = config.trustServerCertificate ?? true;
  const abortTransactionOnError = config.abortTransactionOnError ?? false;
  const poolMin = config.pool?.min ?? 2;
  const poolMax = config.pool?.max ?? 10;
  const logLevels = config.logLevels ?? ['error'];
  const enableQueryOrigin = config.enableQueryOrigin ?? true;
  const projectRoot = config.projectRoot ?? process.cwd();

  const dialect = new MssqlDialect({
    tarn: {
      ...tarn,
      options: {
        min: poolMin,
        max: poolMax,
      },
    },
    tedious: {
      ...tedious,
      // Override string types to use VarChar instead of NVarChar for performance
      TYPES: {
        ...tedious.TYPES,
        ...TEDIOUS_TYPE_UNICODE_OVERWRITES,
      },
      // Use custom Request class with error mapping
      Request,
      connectionFactory: () =>
        new tedious.Connection({
          authentication: {
            options: {
              password: config.password,
              userName: config.user,
            },
            type: 'default',
          },
          options: {
            appName: config.appName,
            port,
            database: config.database,
            trustServerCertificate,
            abortTransactionOnError,
            requestTimeout,
            connectTimeout,
          },
          server: config.server,
        }),
    },
  });

  let finalDialect: Dialect = dialect;
  const plugins: any[] = [];

  if (enableQueryOrigin) {
    const queryOriginPlugin = createQueryOriginPlugin({ projectRoot });
    finalDialect = queryOriginPlugin.wrapDialect(dialect);
    plugins.push(queryOriginPlugin);
  }

  const logger = config.customLogger ?? createLogger(logLevels);

  return new Kysely<DB>({
    dialect: finalDialect,
    log: logger,
    plugins,
  });
}
