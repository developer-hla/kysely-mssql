import { RequestError } from 'tedious';

/**
 * Creates a mock RequestError with specified properties.
 * Used for testing error mapping and error handling logic.
 *
 * Note: We use Object.create to set the correct prototype chain.
 */
export function createMockRequestError(
  errorNumber: number,
  message: string = 'Mock database error',
  options?: {
    lineNumber?: number;
    procName?: string;
  },
): RequestError {
  const error: RequestError = Object.create(RequestError.prototype);
  error.number = errorNumber;
  error.message = message;
  error.name = 'RequestError';
  error.stack = new Error().stack;

  if (options?.lineNumber) {
    error.lineNumber = options.lineNumber;
  }

  if (options?.procName) {
    error.procName = options.procName;
  }

  return error;
}

/**
 * Creates a sample stack trace string for testing QueryOriginPlugin.
 */
export function createMockStackTrace(options: {
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
}): string {
  const functionName = options.functionName || 'testFunction';
  const file = options.file || '/project/src/services/user.service.ts';
  const line = options.line || 42;
  const column = options.column || 15;

  return `Error: Stack trace
    at ${functionName} (${file}:${line}:${column})
    at Object.<anonymous> (/project/src/index.ts:10:5)
    at Module._compile (node:internal/modules/cjs/loader:1256:14)`;
}
