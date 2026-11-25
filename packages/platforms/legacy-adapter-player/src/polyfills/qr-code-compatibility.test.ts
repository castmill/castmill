// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { build, loadConfigFromFile } from 'vite';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

describe('Chromium 38 QR bootstrap', () => {
  it.each(['legacy-adapter-player', 'webos-player'])(
    '%s renders QR modules without native TextEncoder or typed-array slice',
    async (platform) => {
      const platforms = fileURLToPath(new URL('../../..', import.meta.url));
      const root = resolve(platforms, platform);
      const loaded = await loadConfigFromFile(
        { command: 'build', mode: 'production' },
        resolve(root, 'vite.config.ts')
      );
      if (!loaded) throw new Error('Player Vite configuration not found');

      const entry = '\0qr-compatibility';
      const qr = resolve(
        platforms,
        '../player/src/widgets/template/qr-code.tsx'
      );
      const result = await build({
        ...loaded.config,
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        plugins: [
          ...(loaded.config.plugins ?? []).filter(
            (plugin) =>
              !(
                plugin &&
                typeof plugin === 'object' &&
                'name' in plugin &&
                plugin.name === 'legacy-app-shell-worker'
              )
          ),
          {
            name: 'qr-compatibility-entry',
            resolveId: (id) => (id === entry ? id : undefined),
            load: (id) =>
              id === entry
                ? `import { generateQRModules } from ${JSON.stringify(qr)};
                   globalThis.qrResult = generateQRModules(
                     'https://example.com/bostad/2457602?namn=Åhléns', 'H'
                   );`
                : undefined,
          },
        ],
        build: {
          write: false,
          sourcemap: false,
          minify: false,
          rollupOptions: { input: entry },
        },
      });
      if (!Array.isArray(result))
        throw new Error('Expected legacy build outputs');
      const chunks = result
        .flatMap((output) => output.output)
        .filter((output) => output.type === 'chunk');
      const polyfills = chunks.find((chunk) =>
        chunk.fileName.includes('polyfills-legacy')
      );
      const main = chunks.find(
        (chunk) => chunk !== polyfills && chunk.fileName.includes('-legacy')
      );
      if (!polyfills || !main)
        throw new Error('Legacy bootstrap chunks missing');

      const render = (withoutSlice: boolean) => {
        const dom = new JSDOM('', {
          url: 'https://player.test/',
          runScripts: 'outside-only',
        });
        try {
          dom.window.eval(`
            TextEncoder = undefined;
            ${
              withoutSlice
                ? `delete Uint8Array.prototype.slice;
                   delete Object.getPrototypeOf(Uint8Array.prototype).slice;`
                : ''
            }
          `);
          dom.window.eval(polyfills.code);
          dom.window.eval(`
            System.register = function (_, declare) {
              declare(function () {}, { meta: { url: location.href } }).execute();
            };
          `);
          dom.window.eval(main.code);
          return dom.window.eval('JSON.stringify(qrResult)');
        } finally {
          dom.window.close();
        }
      };

      expect(render(true)).to.equal(render(false));
    },
    30_000
  );
});
