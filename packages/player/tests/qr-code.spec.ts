import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';
import { create } from 'qrcode';

import { TemplateWidget, generateQRModules } from '../dist/index.js';

const pathModules = (path: string, size: number) => {
  const dark = Array.from({ length: size * size }, () => false);
  const runs = /M(\d+) (\d+)h(\d+)v1h-\d+z/g;
  let match: RegExpExecArray | null;
  while ((match = runs.exec(path))) {
    const [x, y, width] = match.slice(1).map(Number);
    for (let i = 0; i < width; i++) dark[y * size + x + i] = true;
  }
  return dark;
};

const referenceModules = (content: string, level: 'L' | 'M' | 'Q' | 'H') => {
  const { modules } = create(content, { errorCorrectionLevel: level });
  return Array.from(modules.data, (bit) => !!bit);
};

describe('QR code component', () => {
  it('draws exactly the modules of a standard QR code', () => {
    const content = 'https://www.ahmanmakleri.se/bostader/2457602';
    const { size, path } = generateQRModules(content, 'M');

    // 44 bytes at level M need version 3 (29×29), not a larger grid.
    expect(size).to.equal(29);
    expect(pathModules(path, size)).to.deep.equal(
      referenceModules(content, 'M')
    );
  });

  it('encodes non-ASCII text and honours the error correction level', () => {
    const content = 'Tylöprint – Åhléns';
    const high = generateQRModules(content, 'H');

    expect(pathModules(high.path, high.size)).to.deep.equal(
      referenceModules(content, 'H')
    );
    expect(high.size).to.be.greaterThan(generateQRModules(content, 'L').size);
  });

  it('falls back to level M for unknown levels', () => {
    const content = 'https://castmill.com';
    expect(generateQRModules(content, 'X')).to.deep.equal(
      generateQRModules(content, 'M')
    );
    expect(generateQRModules(content)).to.deep.equal(
      generateQRModules(content, 'M')
    );
  });

  const showQRCode = async (
    listing: Record<string, string>,
    content: unknown,
    run: (root: HTMLElement) => void
  ) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const globals = globalThis as any;
    const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
    const saved: Record<string, unknown> = {};
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = (dom.window as any)[key] ?? dom.window;
    });
    globals.window = dom.window;
    globals.document = dom.window.document;

    const widget = new TemplateWidget({ getMedia: async () => {} } as any, {
      widget: {
        name: 'qr-test',
        template: {
          type: 'group',
          name: 'listing',
          context: { key: 'data.listing' },
          components: [
            {
              type: 'qr-code',
              name: 'qr-code',
              opts: { content, foregroundColor: '#123456' },
              style: { width: '100%', height: '100%' },
            },
          ],
        },
      } as any,
      config: { options: {}, data: { listing } } as any,
      globals: { target: 'poster' },
    });
    const root = dom.window.document.getElementById('root')!;
    try {
      await firstValueFrom(widget.show(root, 0));
      run(root);
    } finally {
      widget.stop();
      await widget.unload();
      keys.forEach((key) => {
        globals[key] = saved[key];
      });
    }
  };

  it('renders bound content as one path scaled through the view box', async () => {
    await showQRCode(
      { estateId: '2457602' },
      { fmt: 'https://example.com/{$.estateId}' },
      (root) => {
        const content = 'https://example.com/2457602';
        const svg = root.querySelector('[data-component="qr-code"] svg')!;
        const paths = svg.querySelectorAll('path');
        const { size, path } = generateQRModules(content, 'M');

        expect(svg.getAttribute('viewBox')).to.equal(`0 0 ${size} ${size}`);
        expect(paths).to.have.length(1);
        expect(paths[0].getAttribute('d')).to.equal(path);
        expect(paths[0].getAttribute('fill')).to.equal('#123456');
        expect(svg.querySelector('rect')!.getAttribute('fill')).to.equal(
          '#ffffff'
        );
      }
    );
  });

  it('renders no code for blank content', async () => {
    await showQRCode({ url: '  ' }, { key: '$.url' }, (root) => {
      const component = root.querySelector('[data-component="qr-code"]');
      expect(component).to.not.equal(null);
      expect(component!.querySelector('svg')).to.equal(null);
    });
  });
});
