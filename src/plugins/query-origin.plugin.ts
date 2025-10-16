import path from 'node:path';
import type {
  DatabaseConnection,
  Dialect,
  Driver,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from 'kysely';

/**
 * Information about the caller of a database query.
 */
export interface CallerInfo {
  file: string;
  line: string;
  column: string;
  functionName: string;
}

/**
 * Driver wrapper that adds query origin tracking.
 * @internal
 */
class QueryOriginDriver implements Driver {
  private readonly connectionMap = new WeakMap<DatabaseConnection, DatabaseConnection>();

  constructor(
    private readonly innerDriver: Driver,
    private readonly captureCallerFn: () => CallerInfo | null,
    private readonly formatCommentFn: (info: CallerInfo) => string,
  ) {}

  async init(): Promise<void> {
    return this.innerDriver.init();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const originalConnection = await this.innerDriver.acquireConnection();
    const wrappedConnection = new QueryOriginConnection(
      originalConnection,
      this.captureCallerFn,
      this.formatCommentFn,
    );
    // Store mapping so we can unwrap later
    this.connectionMap.set(wrappedConnection, originalConnection);
    return wrappedConnection;
  }

  async beginTransaction(
    connection: DatabaseConnection,
    settings: Parameters<Driver['beginTransaction']>[1],
  ): Promise<void> {
    const innerConnection = this.unwrapConnection(connection);
    return this.innerDriver.beginTransaction(innerConnection, settings);
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const innerConnection = this.unwrapConnection(connection);
    return this.innerDriver.commitTransaction(innerConnection);
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const innerConnection = this.unwrapConnection(connection);
    return this.innerDriver.rollbackTransaction(innerConnection);
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const innerConnection = this.unwrapConnection(connection);
    // Clean up the mapping
    this.connectionMap.delete(connection);
    return this.innerDriver.releaseConnection(innerConnection);
  }

  async destroy(): Promise<void> {
    return this.innerDriver.destroy();
  }

  private unwrapConnection(connection: DatabaseConnection): DatabaseConnection {
    return this.connectionMap.get(connection) || connection;
  }
}

/**
 * Database connection wrapper that adds query origin comments.
 * @internal
 */
class QueryOriginConnection implements DatabaseConnection {
  constructor(
    private readonly innerConnection: DatabaseConnection,
    private readonly captureCallerFn: () => CallerInfo | null,
    private readonly formatCommentFn: (info: CallerInfo) => string,
  ) {}

  async executeQuery<O>(
    compiledQuery: Parameters<DatabaseConnection['executeQuery']>[0],
  ): Promise<QueryResult<O>> {
    const callerInfo = this.captureCallerFn();

    if (callerInfo) {
      const comment = this.formatCommentFn(callerInfo);
      const modifiedQuery = {
        ...compiledQuery,
        sql: `${comment} ${compiledQuery.sql}`,
      };
      return this.innerConnection.executeQuery<O>(modifiedQuery);
    }

    return this.innerConnection.executeQuery<O>(compiledQuery);
  }

  async *streamQuery<O>(
    compiledQuery: Parameters<DatabaseConnection['executeQuery']>[0],
    chunkSize?: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!this.innerConnection.streamQuery) {
      throw new Error('Streaming is not supported by this connection');
    }

    const callerInfo = this.captureCallerFn();

    if (callerInfo) {
      const comment = this.formatCommentFn(callerInfo);
      const modifiedQuery = {
        ...compiledQuery,
        sql: `${comment} ${compiledQuery.sql}`,
      };
      yield* this.innerConnection.streamQuery<O>(modifiedQuery, chunkSize);
    } else {
      yield* this.innerConnection.streamQuery<O>(compiledQuery, chunkSize);
    }
  }

  getInnerConnection(): DatabaseConnection {
    return this.innerConnection;
  }
}

/**
 * Dialect wrapper that injects query origin tracking.
 * @internal
 */
class QueryOriginDialect implements Dialect {
  constructor(
    private readonly innerDialect: Dialect,
    private readonly captureCallerFn: () => CallerInfo | null,
    private readonly formatCommentFn: (info: CallerInfo) => string,
  ) {}

  createAdapter() {
    return this.innerDialect.createAdapter();
  }

  createDriver(): Driver {
    const innerDriver = this.innerDialect.createDriver();
    return new QueryOriginDriver(innerDriver, this.captureCallerFn, this.formatCommentFn);
  }

  createIntrospector(db: Parameters<Dialect['createIntrospector']>[0]) {
    return this.innerDialect.createIntrospector(db);
  }

  createQueryCompiler() {
    return this.innerDialect.createQueryCompiler();
  }
}

/**
 * Kysely plugin that automatically adds SQL comments to queries with caller context.
 *
 * This plugin helps with observability by showing which code triggered each query
 * in SQL logs, profilers, and execution plans.
 *
 * @example
 * Output in SQL Server:
 * ```sql
 * /\* caller: getUserById *\/ SELECT * FROM users WHERE id = @1
 * ```
 *
 * The caller comment appears in:
 * - SQL Server Query Store
 * - Activity Monitor
 * - Profiler traces
 * - Application logs
 *
 * @example
 * Basic usage with createConnection:
 * ```typescript
 * // QueryOriginPlugin is included automatically in createConnection()
 * const db = createConnection<DB>({
 *   server: 'localhost',
 *   database: 'MyDB',
 *   // ...
 * });
 *
 * async function getUserById(id: number) {
 *   return await db
 *     .selectFrom('users')
 *     .where('id', '=', id)
 *     .selectAll()
 *     .executeTakeFirst();
 * }
 *
 * // SQL Output: /\* caller: getUserById *\/ SELECT * FROM users WHERE id = @1
 * ```
 *
 * @example
 * Manual usage (advanced):
 * ```typescript
 * const plugin = createQueryOriginPlugin({ projectRoot: '/path/to/project' });
 * const wrappedDialect = plugin.wrapDialect(dialect);
 *
 * const db = new Kysely({
 *   dialect: wrappedDialect,
 *   plugins: [plugin],
 * });
 * ```
 */
export class QueryOriginPlugin implements KyselyPlugin {
  private readonly projectRoot: string;
  private dialectAdapter?: QueryOriginDialect;

  constructor(options?: { projectRoot?: string }) {
    // Auto-detect project root if not provided
    this.projectRoot = options?.projectRoot ?? process.cwd();
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node;
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }

  /**
   * Wraps the dialect to enable query origin tracking.
   * This must be called before creating the Kysely instance.
   *
   * @param dialect - The Kysely dialect to wrap
   * @returns The wrapped dialect with query origin tracking enabled
   */
  wrapDialect(dialect: Dialect): Dialect {
    if (!this.dialectAdapter) {
      this.dialectAdapter = new QueryOriginDialect(
        dialect,
        () => this.captureCallerInfo(),
        (info) => this.formatComment(info),
      );
    }
    return this.dialectAdapter;
  }

  private captureCallerInfo(): CallerInfo | null {
    const stack = new Error().stack;
    if (!stack) {
      return null;
    }

    const lines = stack.split('\n');

    // Start at index 3 to skip Error constructor and internal frames
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);

      if (!match) {
        continue;
      }

      const [, functionName, filePath, lineNum, column] = match;

      // Skip internal code - we only want to see application callers
      if (
        filePath.includes('node_modules') ||
        filePath.includes('kysely') ||
        filePath.includes('query-origin.plugin') ||
        !filePath.startsWith('/') // Skip Node.js internal modules
      ) {
        continue;
      }

      const relativePath = this.makeRelativePath(filePath);
      const cleanFunctionName = (functionName?.trim() || '<anonymous>').replace(/^async\s+/, '');

      return {
        file: relativePath,
        line: lineNum,
        column,
        functionName: cleanFunctionName,
      };
    }

    return null;
  }

  private formatComment(info: CallerInfo): string {
    // Prefer function name if available
    if (info.functionName !== '<anonymous>') {
      return `/* caller: ${info.functionName} */`;
    }

    // Fall back to file:line for anonymous functions
    return `/* caller: ${info.file}:${info.line} */`;
  }

  private makeRelativePath(filePath: string): string {
    const relative = path.relative(this.projectRoot, filePath);

    // If path goes outside project root, just use basename
    if (relative.startsWith('..')) {
      return path.basename(filePath);
    }

    return relative;
  }
}

/**
 * Factory function to create a QueryOriginPlugin instance.
 *
 * @param options - Configuration options
 * @param options.projectRoot - Root directory of your project for relative path resolution.
 *                              Defaults to process.cwd() if not provided.
 * @returns A new QueryOriginPlugin instance
 *
 * @example
 * ```typescript
 * const plugin = createQueryOriginPlugin({
 *   projectRoot: '/Users/me/my-project'
 * });
 * ```
 */
export const createQueryOriginPlugin = (options?: { projectRoot?: string }) => {
  return new QueryOriginPlugin(options);
};
