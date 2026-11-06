import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { JsonPlaylistItem, JsonWidget } from '@castmill/player';

import {
  DEFAULT_MAX_LENGTH,
  countOverrides,
  describeOverrides,
  getOverrides,
  readEditableElement,
  setOverride,
  supportsTextOverrides,
  templateEditables,
  translateEditableLabel,
  TextOverride,
  TextOverrides,
} from './text-overrides';
import { EditableTextStage } from './editable-text-stage';
import { TextOverridesList } from './text-overrides-list';
import { normalizeWidgetOptionsForApi } from './widget-config';
import { PlaylistItem } from './playlist-item';

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: vi.fn(() => () => {}),
  dropTargetForElements: vi.fn(() => () => {}),
}));

const template = {
  type: 'group',
  name: 'root',
  components: [
    {
      type: 'text',
      name: 'street',
      editable: { key: 'street', label: 'Street', max_length: 80 },
    },
    {
      type: 'text',
      name: 'notes',
      editable: { key: 'notes', multiline: true },
    },
    {
      type: 'paginated-list',
      component: {
        type: 'text',
        editable: { key: { fmt: 'fact.{$.id}' }, label: { key: '$.label' } },
      },
    },
    { type: 'image', editable: { key: 'ignored' } },
  ],
};

const widget = (overrides: Partial<JsonWidget> = {}): JsonWidget =>
  ({
    id: 1,
    name: 'Listing',
    template,
    options_schema: {},
    ...overrides,
  }) as JsonWidget;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('text override helpers', () => {
  it('lists static and dynamic editable texts', () => {
    expect(templateEditables(template)).toEqual({
      static: [
        { key: 'street', label: 'Street', multiline: false, maxLength: 80 },
        {
          key: 'notes',
          label: undefined,
          multiline: true,
          maxLength: DEFAULT_MAX_LENGTH,
        },
      ],
      dynamic: true,
    });
    expect(templateEditables(null)).toEqual({ static: [], dynamic: false });

    const cyclic: any = { type: 'group' };
    cyclic.self = cyclic;
    expect(templateEditables(cyclic).static).toEqual([]);
  });

  it('detects widgets that support overrides', () => {
    expect(supportsTextOverrides(widget())).toBe(true);
    expect(supportsTextOverrides(widget({ options_schema: undefined }))).toBe(
      true
    );
    expect(
      supportsTextOverrides(
        widget({ options_schema: { overrides: 'string' } as any })
      )
    ).toBe(false);
    expect(
      supportsTextOverrides(widget({ template: { type: 'text' } as any }))
    ).toBe(false);
    expect(
      supportsTextOverrides(
        widget({
          template: {
            type: 'text',
            editable: { key: { key: '$.id' } },
          } as any,
        })
      )
    ).toBe(true);
  });

  it('reads and updates overrides', () => {
    const options = {
      overrides: {
        a: { text: 'A' },
        b: { hidden: true },
        c: { text: 1 },
        d: null,
      },
    };
    expect(getOverrides(options)).toEqual({
      a: { text: 'A' },
      b: { hidden: true },
    });
    expect(getOverrides({ overrides: [] })).toEqual({});
    expect(getOverrides(null)).toEqual({});
    expect(countOverrides(options)).toBe(2);
    expect(countOverrides(undefined)).toBe(0);

    const next = setOverride({ a: { text: 'A' } }, 'b', { hidden: true });
    expect(next).toEqual({ a: { text: 'A' }, b: { hidden: true } });
    expect(setOverride(next, 'a', undefined)).toEqual({ b: { hidden: true } });
  });

  it('translates labels through widget translations', () => {
    const translated = widget({
      translations: {
        sv: { editable: { Street: 'Gata' } },
        en: { editable: { Notes: 'Notes (en)' } },
      },
    } as any);
    expect(translateEditableLabel(translated, 'Street', 'sv')).toBe('Gata');
    expect(translateEditableLabel(translated, 'Notes', 'sv')).toBe(
      'Notes (en)'
    );
    expect(translateEditableLabel(translated, 'Other', 'sv')).toBe('Other');
    expect(translateEditableLabel(widget(), 'Street', 'sv')).toBe('Street');
    expect(translateEditableLabel(widget(), undefined, 'sv')).toBe(undefined);
  });

  it('reads the player editor hooks', () => {
    const element = document.createElement('div');
    expect(readEditableElement(element)).toBe(undefined);

    element.setAttribute('data-editable-key', 'price');
    element.setAttribute('data-editable-label', 'Price');
    element.setAttribute('data-editable-multiline', 'true');
    element.setAttribute('data-editable-max-length', '40');
    element.setAttribute('data-editable-overridden', 'hidden');
    element.textContent = '4\u00a0950\u00a0000 kr';
    expect(readEditableElement(element)).toEqual({
      key: 'price',
      label: 'Price',
      multiline: true,
      maxLength: 40,
      overridden: 'hidden',
      text: '4 950 000 kr',
    });

    element.setAttribute('data-editable-max-length', 'x');
    element.setAttribute('data-editable-overridden', 'weird');
    element.removeAttribute('data-editable-label');
    const info = readEditableElement(element)!;
    expect(info.maxLength).toBe(DEFAULT_MAX_LENGTH);
    expect(info.overridden).toBe(undefined);
    expect(info.label).toBe(undefined);
  });

  it('splits overrides into used and unused entries', () => {
    const overrides: TextOverrides = {
      street: { text: 'Hidden street' },
      'fact.rooms': { hidden: true },
      removed: { text: 'x' },
    };
    const seen = new Map([['fact.rooms', 'Rooms']]);
    const translate = (label?: string) => (label === 'Street' ? 'Gata' : label);

    expect(
      describeOverrides(
        overrides,
        { static: templateEditables(template).static, dynamic: false },
        seen,
        translate
      )
    ).toEqual({
      used: [
        { key: 'street', label: 'Gata', override: { text: 'Hidden street' } },
        { key: 'fact.rooms', label: 'Rooms', override: { hidden: true } },
      ],
      unused: [{ key: 'removed', label: 'removed', override: { text: 'x' } }],
    });

    // Keys from bindings may not be rendered yet: nothing is reported unused.
    expect(
      describeOverrides(overrides, templateEditables(template), seen, translate)
        .unused
    ).toEqual([]);
  });

  it('keeps overrides when normalizing options for the API', () => {
    const entries: any = [['title', { type: 'string' }]];
    expect(
      normalizeWidgetOptionsForApi(
        { title: 'T', overrides: { a: { text: 'A' } }, junk: 1 } as any,
        entries
      )
    ).toEqual({ title: 'T', overrides: { a: { text: 'A' } } });
    expect(
      normalizeWidgetOptionsForApi({ title: 'T' } as any, entries)
    ).toEqual({ title: 'T' });
    expect(
      normalizeWidgetOptionsForApi(
        { overrides: 'own' } as any,
        [['overrides', { type: 'string' }]] as any
      )
    ).toEqual({ overrides: 'own' });
  });
});

describe('TextOverridesList', () => {
  const labels = {
    title: (count: number) => `Edited texts: ${count}`,
    hidden: 'Hidden',
    empty: '(empty)',
    reset: 'Reset',
    resetAll: 'Reset all',
    unusedTitle: 'Not used',
    unusedHint: 'No longer match',
    remove: 'Remove',
  };

  it('lists overrides with reset actions', () => {
    const onReset = vi.fn();
    const onResetAll = vi.fn();
    render(() => (
      <TextOverridesList
        used={[
          { key: 'street', label: 'Street', override: { text: 'Secret' } },
          { key: 'price', label: 'Price', override: { hidden: true } },
          { key: 'blank', label: 'Blank', override: { text: '' } },
        ]}
        unused={[{ key: 'old', label: 'old', override: { text: 'Old' } }]}
        labels={labels}
        onReset={onReset}
        onResetAll={onResetAll}
      />
    ));

    expect(screen.getByText('Edited texts: 4')).toBeInTheDocument();
    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('(empty)')).toBeInTheDocument();
    expect(screen.getByText('Not used')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Reset: Street'));
    expect(onReset).toHaveBeenCalledWith('street');
    fireEvent.click(screen.getByLabelText('Remove: old'));
    expect(onReset).toHaveBeenCalledWith('old');
    fireEvent.click(screen.getByText('Reset all'));
    expect(onResetAll).toHaveBeenCalled();
  });

  it('renders nothing without overrides', () => {
    render(() => (
      <TextOverridesList
        used={[]}
        unused={[]}
        labels={labels}
        onReset={vi.fn()}
        onResetAll={vi.fn()}
      />
    ));
    expect(screen.queryByText('Edited texts: 0')).toBeNull();
  });
});

describe('EditableTextStage', () => {
  const labels = {
    editAria: (label: string) => `Edit text: ${label}`,
    save: 'Save',
    cancel: 'Cancel',
    hide: 'Hide this text',
    reset: 'Reset to original',
    counter: (length: number, max: number) => `${length} / ${max}`,
  };

  // Mimics the player: rerenders texts from the overrides.
  const setup = (initial: TextOverrides = {}, startActive = true) => {
    const [overrides, setOverrides] = createSignal<TextOverrides>(initial);
    const [active, setActive] = createSignal(startActive);
    const onChange = vi.fn((key: string, value: TextOverride | undefined) =>
      setOverrides((current) => setOverride(current, key, value))
    );
    const onDiscover = vi.fn();
    const shown = (key: string, original: string) => {
      const override = overrides()[key];
      return override ? ('text' in override ? override.text : '') : original;
    };

    render(() => (
      <EditableTextStage
        active={active()}
        overrides={overrides()}
        labels={labels}
        translateLabel={(label) => (label === 'Street' ? 'Gata' : label)}
        onChange={onChange}
        onDiscover={onDiscover}
      >
        <div data-testid="preview">
          <div
            data-editable-key="street"
            data-editable-label="Street"
            data-editable-max-length="10"
            data-editable-overridden={
              overrides().street
                ? 'text' in overrides().street
                  ? 'text'
                  : 'hidden'
                : undefined
            }
          >
            <span>{shown('street', 'Storgatan 1')}</span>
          </div>
          <div data-editable-key="notes" data-editable-multiline="true">
            <span>{shown('notes', 'Line')}</span>
          </div>
          <div data-testid="plain">Plain</div>
        </div>
      </EditableTextStage>
    ));

    const text = (key: string) =>
      document.querySelector(`[data-editable-key="${key}"]`) as HTMLElement;
    return { onChange, onDiscover, setActive, text, overrides };
  };

  it('marks editable texts for keyboard and screen reader users', async () => {
    const { onDiscover, setActive, text } = setup();

    await waitFor(() =>
      expect(text('street')).toHaveAttribute('tabindex', '0')
    );
    expect(text('street')).toHaveAttribute('role', 'button');
    expect(text('street')).toHaveAttribute('aria-label', 'Edit text: Gata');
    expect(text('notes')).toHaveAttribute('title', 'notes');
    expect(onDiscover).toHaveBeenCalledWith(
      new Map([
        ['street', 'Street'],
        ['notes', undefined],
      ])
    );

    setActive(false);
    await waitFor(() => expect(text('street')).not.toHaveAttribute('tabindex'));
    expect(text('street')).not.toHaveAttribute('role');
  });

  it('edits a text in an anchored editor', async () => {
    const { onChange, text } = setup();

    fireEvent.click(text('street').querySelector('span')!);
    const input = await screen.findByLabelText('Gata');
    expect(input).toHaveValue('Storgatan 1');
    expect(input).toHaveAttribute('maxlength', '10');
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Edit text: Gata'
    );
    expect(screen.queryByText('Reset to original')).toBeNull();

    fireEvent.input(input, { target: { value: 'Hemlig adr' } });
    expect(screen.getByText('10 / 10')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('street', { text: 'Hemlig adr' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(text('street')).toHaveTextContent('Hemlig adr');
  });

  it('does not store an unchanged text', async () => {
    const { onChange, text } = setup();

    fireEvent.click(text('street'));
    fireEvent.click(await screen.findByText('Save'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides, resets and cancels', async () => {
    const { onChange, text } = setup({ street: { text: 'Secret' } });

    fireEvent.click(text('street'));
    expect(await screen.findByLabelText('Gata')).toHaveValue('Secret');
    fireEvent.click(screen.getByText('Hide this text'));
    expect(onChange).toHaveBeenLastCalledWith('street', { hidden: true });

    fireEvent.click(text('street'));
    expect(await screen.findByLabelText('Gata')).toHaveValue('');
    fireEvent.click(screen.getByText('Reset to original'));
    expect(onChange).toHaveBeenLastCalledWith('street', undefined);
    expect(text('street')).toHaveTextContent('Storgatan 1');

    fireEvent.click(text('street'));
    await screen.findByLabelText('Gata');
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('closes with Escape before the surrounding dialog', async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer, true);
    const { text } = setup();

    fireEvent.click(text('street'));
    await screen.findByLabelText('Gata');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outer).not.toHaveBeenCalled();

    document.removeEventListener('keydown', outer, true);
  });

  it('opens with the keyboard and saves multiline texts with Ctrl+Enter', async () => {
    const { onChange, text } = setup();

    await waitFor(() => expect(text('notes')).toHaveAttribute('tabindex'));
    const documentKeys = vi.fn();
    document.addEventListener('keydown', documentKeys);
    fireEvent.keyDown(text('notes'), { key: ' ' });
    document.removeEventListener('keydown', documentKeys);
    expect(documentKeys).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('Cancel'));
    fireEvent.keyDown(text('notes'), { key: 'Enter' });
    const textarea = await screen.findByLabelText('notes');
    expect(textarea.tagName).toBe('TEXTAREA');

    fireEvent.input(textarea, { target: { value: 'Line 1\nLine 2' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onChange).toHaveBeenCalledWith('notes', { text: 'Line 1\nLine 2' });
  });

  it('ignores clicks and keys outside edit mode or editable texts', async () => {
    const { text } = setup({}, false);

    fireEvent.click(text('street'));
    fireEvent.keyDown(text('street'), { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores other targets in edit mode', async () => {
    setup();

    fireEvent.click(screen.getByTestId('plain'));
    fireEvent.keyDown(screen.getByTestId('plain'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('plain'), { key: 'x' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the editor when edit mode ends', async () => {
    const { setActive, text } = setup();

    fireEvent.click(text('street'));
    await screen.findByLabelText('Gata');
    setActive(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('PlaylistItem edited indicator', () => {
  const props = {
    index: 0,
    baseUrl: 'http://localhost:4000',
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
    t: (key: string) =>
      key === 'widgets.editableTexts.editedIndicator'
        ? 'Has edited texts'
        : key,
  };
  const item = (options: Record<string, unknown>) =>
    ({
      id: 1,
      duration: 10000,
      offset: 0,
      config: { options },
      widget: widget(),
    }) as unknown as JsonPlaylistItem;

  it('shows when the item has edited texts', () => {
    render(() => (
      <PlaylistItem
        item={item({ overrides: { street: { text: 'x' } } })}
        {...props}
      />
    ));
    expect(screen.getByLabelText('Has edited texts')).toBeInTheDocument();
  });

  it('is absent otherwise', () => {
    render(() => <PlaylistItem item={item({ overrides: {} })} {...props} />);
    expect(screen.queryByTestId('edited-texts-indicator')).toBeNull();
  });
});
