import { describe, expect, it } from 'vitest';
import { getIconUrl, isImageIcon, resolveWidgetIcon } from './widget-icon';

describe('widget icon utils', () => {
  it('detects image icons', () => {
    expect(isImageIcon('data:image/png;base64,x')).toBe(true);
    expect(isImageIcon('https://cdn/x.png')).toBe(true);
    expect(isImageIcon('/widgets/x.svg')).toBe(true);
    expect(isImageIcon('🕒')).toBe(false);
    expect(isImageIcon(undefined)).toBe(false);
  });

  it('prepends baseUrl only to backend-relative paths', () => {
    expect(getIconUrl('/x.svg', 'https://api')).toBe('https://api/x.svg');
    expect(getIconUrl('//cdn/x.svg', 'https://api')).toBe('//cdn/x.svg');
    expect(getIconUrl('https://cdn/x.svg', 'https://api')).toBe(
      'https://cdn/x.svg'
    );
    expect(getIconUrl('', 'https://api')).toBeUndefined();
  });

  it('resolves icons to an image src or a glyph', () => {
    expect(resolveWidgetIcon(' /x.svg ', 'https://api')).toEqual({
      src: 'https://api/x.svg',
    });
    expect(resolveWidgetIcon('🕒', 'https://api')).toEqual({ glyph: '🕒' });
    expect(resolveWidgetIcon(null, 'https://api')).toEqual({});
  });
});
