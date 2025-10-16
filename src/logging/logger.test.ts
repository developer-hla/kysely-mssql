import type { LogEvent } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logger creation', () => {
    it('should return a function', () => {
      const logger = createLogger();

      expect(typeof logger).toBe('function');
    });

    it('should accept log levels array', () => {
      const logger = createLogger(['query', 'error']);

      expect(typeof logger).toBe('function');
    });

    it('should use default levels when none provided', () => {
      const logger = createLogger();

      expect(typeof logger).toBe('function');
    });
  });

  describe('query logging', () => {
    it('should log query events when query level is enabled', () => {
      const logger = createLogger(['query']);

      const event: LogEvent = {
        level: 'query',
        query: {
          sql: 'SELECT * FROM Users WHERE id = $1',
          parameters: [123],
        },
        queryDurationMillis: 42,
      };

      logger(event);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith('[Kysely Query]', {
        sql: 'SELECT * FROM Users WHERE id = $1',
        parameters: [123],
        duration: '42ms',
      });
    });

    it('should not log query events when query level is disabled', () => {
      const logger = createLogger(['error']);

      const event: LogEvent = {
        level: 'query',
        query: {
          sql: 'SELECT * FROM Users',
          parameters: [],
        },
        queryDurationMillis: 10,
      };

      logger(event);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should handle query events without duration', () => {
      const logger = createLogger(['query']);

      const event: LogEvent = {
        level: 'query',
        query: {
          sql: 'SELECT 1',
          parameters: [],
        },
      };

      logger(event);

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Kysely Query]', {
        sql: 'SELECT 1',
        parameters: [],
        duration: undefined,
      });
    });

    it('should handle query events with empty parameters', () => {
      const logger = createLogger(['query']);

      const event: LogEvent = {
        level: 'query',
        query: {
          sql: 'SELECT COUNT(*) FROM Users',
          parameters: [],
        },
        queryDurationMillis: 5,
      };

      logger(event);

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Kysely Query]', {
        sql: 'SELECT COUNT(*) FROM Users',
        parameters: [],
        duration: '5ms',
      });
    });
  });

  describe('error logging', () => {
    it('should log error events when error level is enabled', () => {
      const logger = createLogger(['error']);

      const testError = new Error('Database connection failed');
      const event: LogEvent = {
        level: 'error',
        error: testError,
        query: {
          sql: 'INSERT INTO Users VALUES ($1, $2)',
          parameters: ['John', 'Doe'],
        },
        queryDurationMillis: 100,
      };

      logger(event);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Kysely Error]', {
        error: testError,
        sql: 'INSERT INTO Users VALUES ($1, $2)',
        parameters: ['John', 'Doe'],
        duration: '100ms',
      });
    });

    it('should log error events by default', () => {
      const logger = createLogger();

      const testError = new Error('Query timeout');
      const event: LogEvent = {
        level: 'error',
        error: testError,
        query: {
          sql: 'SELECT * FROM LargeTable',
          parameters: [],
        },
      };

      logger(event);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should not log error events when error level is disabled', () => {
      const logger = createLogger(['query']);

      const testError = new Error('Error message');
      const event: LogEvent = {
        level: 'error',
        error: testError,
        query: {
          sql: 'SELECT 1',
          parameters: [],
        },
      };

      logger(event);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle error events without duration', () => {
      const logger = createLogger(['error']);

      const testError = new Error('Connection timeout');
      const event: LogEvent = {
        level: 'error',
        error: testError,
        query: {
          sql: 'SELECT 1',
          parameters: [],
        },
      };

      logger(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Kysely Error]', {
        error: testError,
        sql: 'SELECT 1',
        parameters: [],
        duration: undefined,
      });
    });
  });

  describe('level filtering', () => {
    it('should enable both query and error when both levels specified', () => {
      const logger = createLogger(['query', 'error']);

      const queryEvent: LogEvent = {
        level: 'query',
        query: { sql: 'SELECT 1', parameters: [] },
      };

      const errorEvent: LogEvent = {
        level: 'error',
        error: new Error('Test error'),
        query: { sql: 'SELECT 1', parameters: [] },
      };

      logger(queryEvent);
      logger(errorEvent);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should filter out disabled levels', () => {
      const logger = createLogger(['error']);

      const queryEvent: LogEvent = {
        level: 'query',
        query: { sql: 'SELECT 1', parameters: [] },
      };

      const errorEvent: LogEvent = {
        level: 'error',
        error: new Error('Test error'),
        query: { sql: 'SELECT 1', parameters: [] },
      };

      logger(queryEvent);
      logger(errorEvent);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty levels array', () => {
      const logger = createLogger([]);

      const queryEvent: LogEvent = {
        level: 'query',
        query: { sql: 'SELECT 1', parameters: [] },
      };

      const errorEvent: LogEvent = {
        level: 'error',
        error: new Error('Test error'),
        query: { sql: 'SELECT 1', parameters: [] },
      };

      logger(queryEvent);
      logger(errorEvent);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('default behavior', () => {
    it('should only log errors by default', () => {
      const logger = createLogger();

      const queryEvent: LogEvent = {
        level: 'query',
        query: { sql: 'SELECT 1', parameters: [] },
      };

      const errorEvent: LogEvent = {
        level: 'error',
        error: new Error('Test error'),
        query: { sql: 'SELECT 1', parameters: [] },
      };

      logger(queryEvent);
      logger(errorEvent);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
