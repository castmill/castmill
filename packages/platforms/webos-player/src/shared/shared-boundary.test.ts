import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('WebOS shared entry point', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('imports without SCAP globals or starting the native application', async () => {
    for (const name of [
      'DeviceInfo',
      'Utility',
      'Signage',
      'Power',
      'Configuration',
      'Storage',
      'Time',
    ]) {
      vi.stubGlobal(name, undefined);
    }
    const shared = await import('@castmill/webos-player/shared');
    expect(shared.createWebosVideoPlayback).toBeTypeOf('function');
    expect(shared.WebosWebSocket).toBeTypeOf('function');
    expect(shared.webosDecoderBudget.size).toBe(0);
  });

  it('keeps every production shared module inside its dependency boundary', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const inspect = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          inspect(path);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts'))
          continue;
        const source = ts.createSourceFile(
          path,
          readFileSync(path, 'utf8'),
          ts.ScriptTarget.Latest,
          true
        );
        const check = (specifier: string) => {
          if (specifier.startsWith('.')) {
            expect(
              resolve(directory, specifier).startsWith(`${root}${sep}`)
            ).toBe(true);
            expect(specifier).not.toMatch(/\.test|\.css/);
          } else {
            expect(['@castmill/player', '@castmill/cache']).toContain(
              specifier
            );
          }
        };
        const visit = (node: ts.Node) => {
          if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            if (
              node.moduleSpecifier &&
              ts.isStringLiteral(node.moduleSpecifier)
            ) {
              check(node.moduleSpecifier.text);
            }
          }
          if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) &&
                node.expression.text === 'require'))
          ) {
            expect(node.arguments).toHaveLength(1);
            const argument = node.arguments[0];
            expect(ts.isStringLiteral(argument)).toBe(true);
            if (ts.isStringLiteral(argument)) check(argument.text);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    };
    inspect(root);
  });
});
