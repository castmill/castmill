import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readStyle = (relativePath: string) =>
  readFileSync(resolve(currentDir, relativePath), 'utf8');

describe('playlist detail responsive styles', () => {
  it('stacks the playlist editor panes on phone-width screens', () => {
    const styles = readStyle('playlist-view.scss');

    expect(styles).toContain('@media (max-width: 48em)');
    expect(styles).toContain('flex-direction: column');
    expect(styles).toContain('max-height: 20em');
    expect(styles).toContain('-webkit-overflow-scrolling: touch');
  });

  it('uses a vertical widget configuration dialog on phone-width screens', () => {
    const styles = readStyle('widget-config.scss');

    expect(styles).toContain('@media (max-width: 48em)');
    expect(styles).toContain('height: 80dvh');
    expect(styles).toContain('flex-direction: column');
    expect(styles).toContain('min-height: 24em');
  });
});
