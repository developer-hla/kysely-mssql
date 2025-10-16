import type { LogEvent } from 'kysely';

/**
 * Log levels supported by the logger.
 */
export type LogLevel = 'query' | 'error';

/**
 * Creates a Kysely log function that logs to console.
 *
 * This is a simple console-based logger. For production use, you may want
 * to integrate with your application's logging framework.
 *
 * @param levels - Array of log levels to enable. Default: ['error']
 * @returns A log function compatible with Kysely's LogConfig
 *
 * @example
 * ```typescript
 * // Log only errors (default)
 * const logger = createLogger(['error']);
 *
 * // Log queries and errors (verbose, for development)
 * const logger = createLogger(['query', 'error']);
 * ```
 */
export function createLogger(levels: LogLevel[] = ['error']) {
  return (event: LogEvent): void => {
    // Only log if this level is enabled
    if (!levels.includes(event.level as LogLevel)) {
      return;
    }

    if (event.level === 'query') {
      // Log query events to debug
      console.debug('[Kysely Query]', {
        sql: event.query.sql,
        parameters: event.query.parameters,
        duration: event.queryDurationMillis ? `${event.queryDurationMillis}ms` : undefined,
      });
    } else if (event.level === 'error') {
      // Log error events to error
      console.error('[Kysely Error]', {
        error: event.error,
        sql: event.query.sql,
        parameters: event.query.parameters,
        duration: event.queryDurationMillis ? `${event.queryDurationMillis}ms` : undefined,
      });
    }
  };
}
