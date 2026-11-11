import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import {
  Choice,
  ChoicesField,
  ChoicesFieldLabels,
  ChoicesFieldProps,
  ChoicesPage,
  ChoicesRequest,
  FONT_SAMPLE,
  loadPreviewFont,
} from './choices-field';

const labels: ChoicesFieldLabels = {
  choose: 'Choose',
  change: 'Change',
  add: 'Add photos',
  clear: 'Clear',
  remove: 'Remove',
  moveBefore: 'Move earlier',
  moveAfter: 'Move later',
  search: 'Search',
  loadMore: 'Load more',
  retry: 'Retry',
  noResults: 'No results',
  noSelection: 'Nothing selected',
  unavailable: 'No longer available',
  selectAll: 'Select all',
  selectNone: 'Select none',
  selected: (count, max) =>
    max ? `${count} of ${max} selected` : `${count} selected`,
  done: 'Done',
  cancel: 'Cancel',
  play: 'Play',
  stop: 'Stop',
  enlarge: 'Enlarge',
  close: 'Close',
  dialogDescription: 'Pick from the list',
};

const photo = (n: number, extra: Partial<Choice> = {}): Choice => ({
  value: `p${n}`,
  label: `Photo ${n}`,
  description: `Room ${n}`,
  thumbnail_url: `https://img.example/p${n}.jpg`,
  ...extra,
});

const pages = (all: Choice[], pageSize = 10) =>
  vi.fn(async (request: ChoicesRequest): Promise<ChoicesPage> => {
    const matching = all.filter((c) => c.label.includes(request.query));
    const offset = request.cursor ? Number(request.cursor) : 0;
    const next =
      offset + pageSize < matching.length ? String(offset + pageSize) : null;
    return { items: matching.slice(offset, offset + pageSize), next };
  });

const setup = (
  props: Partial<ChoicesFieldProps> & { initial?: string | string[] }
) => {
  const [value, setValue] = createSignal<string | string[] | undefined>(
    props.initial
  );
  const onChange = vi.fn((v: string | string[] | undefined) => setValue(v));
  const loadChoices =
    props.loadChoices || pages([1, 2, 3].map((n) => photo(n)));

  render(() => (
    <ChoicesField
      id="photos"
      label="Photos"
      labels={labels}
      errorMessage={(error) => `Failed: ${(error as Error).message}`}
      searchDebounceMs={0}
      {...props}
      value={value()}
      loadChoices={loadChoices}
      onChange={onChange}
    />
  ));

  return { onChange, loadChoices, value };
};

const options = () => screen.getAllByRole('option');

describe('ChoicesField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('single value', () => {
    it('chooses a value from the dialog', async () => {
      const { onChange, loadChoices } = setup({ display: 'cards' });

      expect(screen.getByText('Nothing selected')).toBeInTheDocument();
      expect(loadChoices).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(3));
      expect(screen.getByText('Pick from the list')).toBeInTheDocument();
      expect(screen.getByText('Room 2')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Photo 2'));
      expect(onChange).toHaveBeenCalledWith('p2');

      await waitFor(() =>
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      );
      expect(screen.getByText('Photo 2')).toBeInTheDocument();
      expect(screen.getByText('Change')).toBeInTheDocument();
    });

    it('shows the saved choice and clears it', async () => {
      const { onChange, loadChoices } = setup({
        initial: 'p3',
        display: 'cards',
      });

      await waitFor(() =>
        expect(screen.getByText('Photo 3')).toBeInTheDocument()
      );
      expect(loadChoices).toHaveBeenCalledWith({
        query: '',
        cursor: null,
        values: ['p3'],
      });

      fireEvent.click(screen.getByText('Clear'));
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('hides clear for required fields and shows list display without visuals', async () => {
      setup({ initial: 'p1', required: true });

      await waitFor(() =>
        expect(screen.getByText('Photo 1')).toBeInTheDocument()
      );
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();
    });

    it('marks values the provider no longer returns', async () => {
      setup({ initial: 'gone', display: 'cards' });

      await waitFor(() =>
        expect(screen.getByText('No longer available')).toBeInTheDocument()
      );
    });

    it('selects with the keyboard and moves focus with arrow keys', async () => {
      const { onChange } = setup({ display: 'list' });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(3));

      options()[0].focus();
      fireEvent.keyDown(options()[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(options()[1]);
      fireEvent.keyDown(options()[1], { key: 'End' });
      expect(document.activeElement).toBe(options()[2]);
      fireEvent.keyDown(options()[2], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(options()[2]);
      fireEvent.keyDown(options()[2], { key: 'Home' });
      expect(document.activeElement).toBe(options()[0]);
      fireEvent.keyDown(options()[0], { key: 'a' });

      fireEvent.keyDown(options()[0], { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('p1');
    });

    it('does not select an option when a nested preview button receives a key', async () => {
      const { onChange } = setup({
        display: 'cards',
        loadChoices: pages([
          photo(1, {
            preview: {
              type: 'video',
              url: 'https://video.example/preview.mp4',
            },
          }),
        ]),
      });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(1));

      for (const key of ['Enter', ' ']) {
        const event = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        screen.getByLabelText('Play').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('multiple values', () => {
    it('adds choices in click order and applies them on done', async () => {
      const { onChange } = setup({
        multiple: true,
        ordered: true,
        display: 'grid',
        max: 2,
        emptyHint: 'All photos are shown',
      });

      expect(screen.getByText('All photos are shown')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Add photos'));
      await waitFor(() => expect(options()).toHaveLength(3));

      fireEvent.click(options()[2]);
      fireEvent.click(options()[0]);
      expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();
      expect(options()[1]).toHaveAttribute('aria-disabled', 'true');
      expect(options()[2]).toHaveTextContent('1');
      expect(options()[0]).toHaveTextContent('2');

      fireEvent.click(options()[1]);
      expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();

      fireEvent.click(options()[2]);
      expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Done'));
      expect(onChange).toHaveBeenCalledWith(['p1']);
    });

    it('selects all, none and cancels without changes', async () => {
      const { onChange } = setup({ multiple: true, display: 'cards' });

      fireEvent.click(screen.getByText('Add photos'));
      await waitFor(() => expect(options()).toHaveLength(3));

      fireEvent.click(screen.getByText('Select all'));
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      expect(options()[0]).toHaveTextContent('✓');

      fireEvent.click(screen.getByText('Select none'));
      expect(screen.getByText('0 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('respects max when selecting all and min for done', async () => {
      const { onChange } = setup({
        multiple: true,
        min: 1,
        max: 2,
        loadChoices: pages([
          photo(1),
          photo(2, { disabled: true }),
          photo(3),
          photo(4),
        ]),
      });

      fireEvent.click(screen.getByText('Add photos'));
      await waitFor(() => expect(options()).toHaveLength(4));

      expect(screen.getByText('Done').closest('button')).toBeDisabled();
      fireEvent.click(options()[1]);
      expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Select all'));
      expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Done'));
      expect(onChange).toHaveBeenCalledWith(['p1', 'p3']);
    });

    it('reorders and removes selected values', async () => {
      const { onChange } = setup({
        multiple: true,
        ordered: true,
        display: 'grid',
        initial: ['p1', 'p2', 'gone'],
      });

      await waitFor(() =>
        expect(screen.getByText('No longer available')).toBeInTheDocument()
      );
      const tiles = screen.getAllByTestId('selected-tile');
      expect(tiles).toHaveLength(3);
      expect(tiles[0]).toHaveTextContent('1');

      const earlier = screen.getAllByLabelText('Move earlier');
      const later = screen.getAllByLabelText('Move later');
      expect(earlier[0]).toBeDisabled();
      expect(later[2]).toBeDisabled();

      fireEvent.click(later[0]);
      expect(onChange).toHaveBeenLastCalledWith(['p2', 'p1', 'gone']);

      fireEvent.click(screen.getAllByLabelText('Move earlier')[2]);
      expect(onChange).toHaveBeenLastCalledWith(['p2', 'gone', 'p1']);

      fireEvent.click(screen.getAllByLabelText('Remove')[1]);
      expect(onChange).toHaveBeenLastCalledWith(['p2', 'p1']);
    });

    it('reorders by drag and drop', async () => {
      const { onChange } = setup({
        multiple: true,
        ordered: true,
        initial: ['p1', 'p2', 'p3'],
      });

      await waitFor(() =>
        expect(screen.getByText('Photo 3')).toBeInTheDocument()
      );
      const tiles = screen.getAllByTestId('selected-tile');
      fireEvent.dragStart(tiles[2]);
      fireEvent.dragOver(tiles[0]);
      fireEvent.drop(tiles[0]);
      expect(onChange).toHaveBeenLastCalledWith(['p3', 'p1', 'p2']);

      fireEvent.drop(tiles[1]);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('removes values when not ordered', async () => {
      const { onChange } = setup({ multiple: true, initial: ['p1', 'p2'] });

      await waitFor(() =>
        expect(screen.getByText('Photo 2')).toBeInTheDocument()
      );
      expect(screen.queryByLabelText('Move earlier')).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByLabelText('Remove')[0]);
      expect(onChange).toHaveBeenCalledWith(['p2']);
    });
  });

  describe('loading', () => {
    it('searches, pages and deduplicates results', async () => {
      const all = Array.from({ length: 5 }, (_, i) => photo(i + 1));
      const loadChoices = pages(all, 2);
      setup({ search: true, loadChoices });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(2));

      fireEvent.click(screen.getByText('Load more'));
      await waitFor(() => expect(options()).toHaveLength(4));
      expect(loadChoices).toHaveBeenLastCalledWith({
        query: '',
        cursor: '2',
        values: [],
      });

      fireEvent.input(screen.getByLabelText('Search'), {
        target: { value: 'Photo 5' },
      });
      await waitFor(() => expect(options()).toHaveLength(1));
      expect(screen.queryByText('Load more')).not.toBeInTheDocument();

      fireEvent.input(screen.getByLabelText('Search'), {
        target: { value: 'nothing' },
      });
      await waitFor(() =>
        expect(screen.getByText('No results')).toBeInTheDocument()
      );
    });

    it('retries a failed new search from its first page', async () => {
      let failSearch = false;
      const loadChoices = vi.fn(async (request: ChoicesRequest) => {
        if (request.query === 'new search' && failSearch) {
          throw new Error('provider_error');
        }

        return request.query
          ? { items: [photo(3)], next: null }
          : { items: [photo(1), photo(2)], next: '2' };
      });
      setup({ search: true, loadChoices });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(2));

      failSearch = true;
      fireEvent.input(screen.getByLabelText('Search'), {
        target: { value: 'new search' },
      });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed: provider_error'
        )
      );
      expect(screen.queryAllByRole('option')).toHaveLength(0);

      failSearch = false;
      fireEvent.click(screen.getByText('Retry'));
      await waitFor(() => expect(options()).toHaveLength(1));
      expect(loadChoices).toHaveBeenLastCalledWith({
        query: 'new search',
        cursor: null,
        values: [],
      });
    });

    it('shows errors with retry', async () => {
      let fail = true;
      const loadChoices = vi.fn(async () => {
        if (fail) throw new Error('provider_error');
        return { items: [photo(1)], next: null };
      });
      setup({ loadChoices, initial: 'p1' });

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed: provider_error'
        )
      );
      fail = false;
      fireEvent.click(screen.getByText('Retry'));
      await waitFor(() =>
        expect(screen.getByText('Photo 1')).toBeInTheDocument()
      );

      fail = true;
      fireEvent.click(screen.getByText('Change'));
      await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
      fail = false;
      fireEvent.click(screen.getByText('Retry'));
      await waitFor(() => expect(options()).toHaveLength(1));
    });

    it('stays disabled with a hint until dependencies are set', async () => {
      const [disabled, setDisabled] = createSignal(true);
      const [reloadKey, setReloadKey] = createSignal('a');
      const loadChoices = pages([photo(1)]);

      render(() => (
        <ChoicesField
          id="photos"
          label="Photos"
          labels={labels}
          errorMessage={() => 'error'}
          value={['p1']}
          multiple
          disabled={disabled()}
          disabledHint="Choose a listing first"
          reloadKey={reloadKey()}
          loadChoices={loadChoices}
          onChange={() => {}}
        />
      ));

      expect(screen.getByText('Choose a listing first')).toBeInTheDocument();
      expect(screen.getByText('Add photos').closest('button')).toBeDisabled();
      expect(loadChoices).not.toHaveBeenCalled();

      setDisabled(false);
      await waitFor(() => expect(loadChoices).toHaveBeenCalledTimes(1));

      setReloadKey('b');
      await waitFor(() => expect(loadChoices).toHaveBeenCalledTimes(2));
    });
  });

  describe('previews', () => {
    it('enlarges image previews and closes them with Escape', async () => {
      setup({
        display: 'grid',
        loadChoices: pages([
          photo(1, {
            preview: { type: 'image', url: 'https://img.example/p1-large.jpg' },
          }),
        ]),
      });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(1));

      fireEvent.click(screen.getByLabelText('Enlarge'));
      const enlarged = screen.getByRole('dialog', { name: 'Photo 1' });
      expect(enlarged.querySelector('img')).toHaveAttribute(
        'src',
        'https://img.example/p1-large.jpg'
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Photo 1' })).toBeNull();
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Enlarge'));
      const enlargedAgain = screen.getByRole('dialog', { name: 'Photo 1' });
      fireEvent.click(within(enlargedAgain).getByLabelText('Close'));
      expect(screen.queryByRole('dialog', { name: 'Photo 1' })).toBeNull();
    });

    it('plays video previews on hover and with the play button', async () => {
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {});

      setup({
        display: 'grid',
        loadChoices: pages([
          photo(1, {
            preview: { type: 'video', url: 'https://v.example/1.mp4' },
          }),
        ]),
      });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(1));

      const visual = screen.getByTestId('video-preview').parentElement!;
      fireEvent.mouseEnter(visual);
      expect(play).toHaveBeenCalledTimes(1);
      fireEvent.mouseLeave(visual);
      expect(pause).toHaveBeenCalled();

      fireEvent.click(screen.getByLabelText('Play'));
      expect(play).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByLabelText('Stop'));
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
    });

    it('plays one audio preview at a time', async () => {
      const instances: any[] = [];
      class FakeAudio {
        onended: (() => void) | null = null;
        play = vi.fn(() => Promise.resolve());
        pause = vi.fn();
        constructor(public src: string) {
          instances.push(this);
        }
      }
      vi.stubGlobal('Audio', FakeAudio);

      setup({
        display: 'cards',
        loadChoices: pages([
          photo(1, {
            preview: { type: 'audio', url: 'https://a.example/1.mp3' },
          }),
          photo(2, {
            preview: { type: 'audio', url: 'https://a.example/2.mp3' },
          }),
        ]),
      });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(2));

      fireEvent.click(screen.getAllByLabelText('Play')[0]);
      expect(instances[0].play).toHaveBeenCalled();
      fireEvent.click(screen.getAllByLabelText('Play')[0]);
      expect(instances[0].pause).toHaveBeenCalled();
      expect(instances[1].play).toHaveBeenCalled();

      instances[1].onended();
      expect(screen.getAllByLabelText('Play')).toHaveLength(2);

      fireEvent.click(screen.getAllByLabelText('Play')[0]);
      fireEvent.click(screen.getByLabelText('Stop'));
      expect(screen.getAllByLabelText('Play')).toHaveLength(2);
      vi.unstubAllGlobals();
    });

    it('renders font samples with the loaded font', async () => {
      const add = vi.fn();
      class FakeFontFace {
        constructor(public family: string) {}
        load() {
          return Promise.resolve(this);
        }
      }
      vi.stubGlobal('FontFace', FakeFontFace);
      Object.defineProperty(document, 'fonts', {
        value: { add },
        configurable: true,
      });

      setup({
        display: 'grid',
        loadChoices: pages([
          photo(1, {
            preview: { type: 'font', url: 'https://f.example/font.woff2' },
          }),
          photo(2, { preview: { type: 'hologram', url: 'https://x.example' } }),
          { value: 'x', label: 'xylophone' },
        ]),
      });

      fireEvent.click(screen.getByText('Choose'));
      await waitFor(() => expect(options()).toHaveLength(3));

      const sample = screen.getByTestId('font-sample');
      expect(sample).toHaveTextContent(FONT_SAMPLE);
      await waitFor(() =>
        expect(sample.style.fontFamily).toMatch(/castmill-choice/)
      );
      expect(add).toHaveBeenCalledTimes(1);
      expect(options()[1].querySelector('img')).toHaveAttribute(
        'src',
        'https://img.example/p2.jpg'
      );
      expect(options()[2]).toHaveTextContent('X');

      vi.unstubAllGlobals();
    });

    it('updates font samples and ignores superseded font loads', async () => {
      const pending: {
        source: string;
        resolve: () => void;
      }[] = [];
      class FakeFontFace {
        constructor(
          public family: string,
          public source: string
        ) {}
        load() {
          return new Promise<FontFace>((resolve) => {
            pending.push({
              source: this.source,
              resolve: () => resolve(this as any),
            });
          });
        }
      }
      vi.stubGlobal('FontFace', FakeFontFace);
      Object.defineProperty(document, 'fonts', {
        value: { add: vi.fn() },
        configurable: true,
      });

      setup({
        initial: 'p1',
        display: 'cards',
        loadChoices: pages([
          photo(1, {
            preview: {
              type: 'font',
              url: 'https://f.example/reactive-a.woff2',
            },
          }),
          photo(2, {
            preview: {
              type: 'font',
              url: 'https://f.example/reactive-b.woff2',
            },
          }),
        ]),
      });

      const sample = await screen.findByTestId('font-sample');
      await waitFor(() =>
        expect(
          pending.some(({ source }) => source.includes('reactive-a'))
        ).toBe(true)
      );

      fireEvent.click(screen.getByText('Change'));
      await waitFor(() => expect(options()).toHaveLength(2));
      await waitFor(() =>
        expect(
          pending.some(({ source }) => source.includes('reactive-b'))
        ).toBe(true)
      );
      fireEvent.click(screen.getByText('Photo 2'));

      const fontB = pending.find(({ source }) =>
        source.includes('reactive-b')
      )!;
      fontB.resolve();
      await waitFor(() =>
        expect(sample.style.fontFamily).toMatch(/castmill-choice/)
      );
      const selectedFamily = sample.style.fontFamily;

      pending.find(({ source }) => source.includes('reactive-a'))!.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sample.style.fontFamily).toBe(selectedFamily);
      vi.unstubAllGlobals();
    });

    it('resolves fonts to null when they cannot load', async () => {
      vi.stubGlobal(
        'FontFace',
        class {
          load() {
            return Promise.reject(new Error('nope'));
          }
        }
      );
      await expect(
        loadPreviewFont('https://f.example/broken.woff2')
      ).resolves.toBeNull();
      vi.unstubAllGlobals();

      vi.stubGlobal('FontFace', undefined);
      await expect(
        loadPreviewFont('https://f.example/other.woff2')
      ).resolves.toBeNull();
      vi.unstubAllGlobals();
    });
  });
});
