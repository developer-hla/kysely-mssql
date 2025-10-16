import type { RequestError } from 'tedious';

/**
 * Base class for all database errors.
 * Wraps Tedious RequestError with additional context and proper Error prototype chain.
 */
export class DatabaseError extends Error {
  public override readonly name: string;
  public override readonly stack?: string;

  constructor(
    message: string,
    public requestError: RequestError,
  ) {
    super(message);

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'DatabaseError';

    // Ensure error properties are properly defined
    redefineErrorProperties(this.requestError);

    // Capture stack trace
    Error.captureStackTrace(this);
  }
}

/**
 * Helper function to redefine error properties for proper serialization
 */
function redefineErrorProperties(error: RequestError) {
  // Copy message from prototype to instance
  Object.defineProperty(error, 'message', {
    value: error.message,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // Add cause if provided
  if (error.cause) {
    Object.defineProperty(error, 'cause', {
      value: error.cause,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  // Add stack if provided
  if (error.stack) {
    Object.defineProperty(error, 'stack', {
      value: error.stack,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
}
