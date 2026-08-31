import { describe, expect, it } from 'vitest';
import { validateWidgetTemplate } from './widget-template-validation';

describe('validateWidgetTemplate', () => {
  it('accepts a valid nested template', () => {
    expect(
      validateWidgetTemplate({
        type: 'group',
        name: 'root',
        components: [
          {
            type: 'text',
            name: 'headline',
            opts: { text: 'Hello' },
            style: { color: '#fff' },
          },
        ],
      })
    ).toBeNull();
  });

  it('reports the path of an unsupported nested component', () => {
    expect(
      validateWidgetTemplate({
        type: 'group',
        name: 'root',
        components: [{ type: 'unknown', name: 'broken', opts: {} }],
      })
    ).toBe('template.components[0]');
  });

  it('rejects component options with an invalid shape', () => {
    expect(
      validateWidgetTemplate({
        type: 'text',
        name: 'headline',
        opts: null,
      })
    ).toBe('template');
  });

  it('validates list item templates', () => {
    expect(
      validateWidgetTemplate({
        type: 'scroller',
        name: 'items',
        opts: { items: { key: 'data.items' } },
      })
    ).toBe('template.component');
  });
});
