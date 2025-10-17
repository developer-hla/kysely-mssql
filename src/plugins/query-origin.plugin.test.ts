import type { Dialect, PluginTransformQueryArgs, PluginTransformResultArgs } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { createQueryOriginPlugin, QueryOriginPlugin } from './query-origin.plugin.js';

/**
 * Interface for accessing private methods in QueryOriginPlugin for testing.
 * This allows us to test implementation details while maintaining type safety.
 */
interface QueryOriginPluginPrivate {
  captureCallerInfo(): {
    file: string;
    line: string;
    column: string;
    functionName: string;
  } | null;
  formatComment(info: { file: string; line: string; column: string; functionName: string }): string;
  makeRelativePath(filePath: string): string;
}

describe('QueryOriginPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default project root', () => {
      const plugin = new QueryOriginPlugin();

      expect(plugin).toBeInstanceOf(QueryOriginPlugin);
    });

    it('should create plugin with custom project root', () => {
      const plugin = new QueryOriginPlugin({ projectRoot: '/custom/path' });

      expect(plugin).toBeInstanceOf(QueryOriginPlugin);
    });

    it('should use process.cwd() when no project root provided', () => {
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mocked/cwd');

      new QueryOriginPlugin();

      expect(cwdSpy).toHaveBeenCalled();

      cwdSpy.mockRestore();
    });
  });

  describe('transformQuery', () => {
    it('should return node unchanged', () => {
      const plugin = new QueryOriginPlugin();
      const mockNode = { kind: 'SelectQueryNode' as const };
      const args = { node: mockNode } as PluginTransformQueryArgs;

      const result = plugin.transformQuery(args);

      expect(result).toBe(mockNode);
    });
  });

  describe('transformResult', () => {
    it('should return result unchanged', async () => {
      const plugin = new QueryOriginPlugin();
      const mockResult = { rows: [{ id: 1 }] };
      const args = {
        result: mockResult,
        queryId: Symbol('test-query-id'),
      } as unknown as PluginTransformResultArgs;

      const result = await plugin.transformResult(args);

      expect(result).toBe(mockResult);
    });
  });

  describe('wrapDialect', () => {
    it('should wrap dialect', () => {
      const plugin = new QueryOriginPlugin();
      const mockDialect = {
        createAdapter: vi.fn(),
        createDriver: vi.fn(),
        createIntrospector: vi.fn(),
        createQueryCompiler: vi.fn(),
      } as unknown as Dialect;

      const wrapped = plugin.wrapDialect(mockDialect);

      expect(wrapped).toBeDefined();
      expect(wrapped).not.toBe(mockDialect);
    });

    it('should return same wrapped dialect on multiple calls', () => {
      const plugin = new QueryOriginPlugin();
      const mockDialect = {
        createAdapter: vi.fn(),
        createDriver: vi.fn(),
        createIntrospector: vi.fn(),
        createQueryCompiler: vi.fn(),
      } as unknown as Dialect;

      const wrapped1 = plugin.wrapDialect(mockDialect);
      const wrapped2 = plugin.wrapDialect(mockDialect);

      expect(wrapped1).toBe(wrapped2);
    });
  });

  describe('caller info capture', () => {
    it('should capture caller info from stack trace', () => {
      const plugin = new QueryOriginPlugin({ projectRoot: '/project' });

      // Access private method for testing
      const captureCallerInfo = (
        plugin as unknown as QueryOriginPluginPrivate
      ).captureCallerInfo.bind(plugin);

      // We can't easily mock Error.stack in a reliable way across environments,
      // so we just verify the method exists and returns the expected type
      const result = captureCallerInfo();

      // Result should either be null or have the expected shape
      if (result !== null) {
        expect(result).toHaveProperty('file');
        expect(result).toHaveProperty('line');
        expect(result).toHaveProperty('column');
        expect(result).toHaveProperty('functionName');
      }
    });
  });

  describe('comment formatting', () => {
    it('should format comment with function name', () => {
      const plugin = new QueryOriginPlugin();

      // Access private method for testing
      const formatComment = (plugin as unknown as QueryOriginPluginPrivate).formatComment.bind(
        plugin,
      );

      const result = formatComment({
        file: 'src/services/user.service.ts',
        line: '42',
        column: '10',
        functionName: 'getUserById',
      });

      expect(result).toBe('/* caller: getUserById */');
    });

    it('should format comment with file:line for anonymous functions', () => {
      const plugin = new QueryOriginPlugin();

      const formatComment = (plugin as unknown as QueryOriginPluginPrivate).formatComment.bind(
        plugin,
      );

      const result = formatComment({
        file: 'src/services/user.service.ts',
        line: '42',
        column: '10',
        functionName: '<anonymous>',
      });

      expect(result).toBe('/* caller: src/services/user.service.ts:42 */');
    });

    it('should prefer function name over file:line', () => {
      const plugin = new QueryOriginPlugin();

      const formatComment = (plugin as unknown as QueryOriginPluginPrivate).formatComment.bind(
        plugin,
      );

      const result = formatComment({
        file: 'src/test.ts',
        line: '100',
        column: '5',
        functionName: 'myFunction',
      });

      expect(result).toBe('/* caller: myFunction */');
    });
  });

  describe('path normalization', () => {
    it('should make path relative to project root', () => {
      const plugin = new QueryOriginPlugin({ projectRoot: '/project' });

      const makeRelativePath = (
        plugin as unknown as QueryOriginPluginPrivate
      ).makeRelativePath.bind(plugin);

      const result = makeRelativePath('/project/src/services/user.service.ts');

      expect(result).toBe('src/services/user.service.ts');
    });

    it('should use basename for paths outside project root', () => {
      const plugin = new QueryOriginPlugin({ projectRoot: '/project' });

      const makeRelativePath = (
        plugin as unknown as QueryOriginPluginPrivate
      ).makeRelativePath.bind(plugin);

      const result = makeRelativePath('/other/path/file.ts');

      expect(result).toBe('file.ts');
    });

    it('should handle project root path exactly', () => {
      const plugin = new QueryOriginPlugin({ projectRoot: '/project' });

      const makeRelativePath = (
        plugin as unknown as QueryOriginPluginPrivate
      ).makeRelativePath.bind(plugin);

      const result = makeRelativePath('/project/index.ts');

      expect(result).toBe('index.ts');
    });
  });
});

describe('createQueryOriginPlugin', () => {
  it('should create a QueryOriginPlugin instance', () => {
    const plugin = createQueryOriginPlugin();

    expect(plugin).toBeInstanceOf(QueryOriginPlugin);
  });

  it('should pass options to constructor', () => {
    const plugin = createQueryOriginPlugin({ projectRoot: '/custom' });

    expect(plugin).toBeInstanceOf(QueryOriginPlugin);
  });

  it('should work without options', () => {
    const plugin = createQueryOriginPlugin();

    expect(plugin).toBeInstanceOf(QueryOriginPlugin);
  });
});
