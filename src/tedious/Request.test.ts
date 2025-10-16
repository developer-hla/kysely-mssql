import { Request as TediousRequest } from 'tedious';
import { describe, expect, it, vi } from 'vitest';
import { createMockRequestError } from '../test-utils/factories.js';
import { mapDatabaseError } from './error-mapper.js';
import { Request } from './Request.js';

describe('Request', () => {
  describe('constructor', () => {
    it('should create a Request instance', () => {
      const callback = vi.fn();
      const request = new Request('SELECT 1', callback);

      expect(request).toBeInstanceOf(Request);
      expect(request).toBeInstanceOf(TediousRequest);
    });

    it('should accept SQL text parameter', () => {
      const callback = vi.fn();
      const request = new Request('SELECT * FROM Users', callback);

      expect(request).toBeInstanceOf(Request);
    });

    it('should accept undefined as SQL text', () => {
      const callback = vi.fn();
      const request = new Request(undefined, callback);

      expect(request).toBeInstanceOf(Request);
    });

    it('should accept options parameter', () => {
      const callback = vi.fn();
      const options = { statementColumnEncryptionSetting: 1 };
      const request = new Request('SELECT 1', callback, options);

      expect(request).toBeInstanceOf(Request);
    });

    it('should extend TediousRequest', () => {
      const callback = vi.fn();
      const request = new Request('SELECT 1', callback);

      expect(Object.getPrototypeOf(Request)).toBe(TediousRequest);
      expect(request).toBeInstanceOf(TediousRequest);
    });
  });

  describe('error mapping integration', () => {
    it('should use mapDatabaseError for error transformation', () => {
      const callback = vi.fn();
      new Request('SELECT 1', callback);

      const requestError = createMockRequestError(547, 'Foreign key violation');
      const mappedError = mapDatabaseError(requestError);

      expect(mappedError).not.toBe(requestError);
      expect(mappedError.message).toBe('Referenced record does not exist');
    });
  });
});
