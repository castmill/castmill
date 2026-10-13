import { onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Text } from '../../../../player/src/widgets/template/text';
import { Scroller } from '../../../../player/src/widgets/template/scroller';
import { PaginatedList } from '../../../../player/src/widgets/template/paginated-list';
import { Timeline } from '../../../../player/src/widgets/template/timeline';
import type { ResourceManager } from '@castmill/cache';
import { TemplateComponentType } from '../../../../player/src/widgets/template/template';

vi.mock('../../../../player/src/widgets/template/item', () => ({
  Item: (props: { onReady: () => void }) => {
    onMount(() => props.onReady());
    return <div>Item</div>;
  },
}));

describe('rotated widget geometry', () => {
  let root: HTMLDivElement;
  let dispose: () => void;
  let timeline: Timeline;
  let angle = 0;
  let width = 600;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(Date.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    angle = 0;
    width = 600;
    timeline = new Timeline('rotated-widget');
    root = document.createElement('div');
    root.dataset.castmillOrientation = '0';
    document.body.appendChild(root);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const span = this as HTMLElement;
        const fontSize = parseFloat(span.style.fontSize) || 1;
        const size =
          span.style.width === '1em'
            ? { width: 20, height: 0 }
            : this.tagName === 'SPAN'
              ? { width: fontSize * 100, height: fontSize * 20 }
              : { width, height: 100 };
        return (
          angle === 90 || angle === 270
            ? { width: size.height, height: size.width }
            : size
        ) as DOMRect;
      }
    );
  });

  afterEach(() => {
    dispose?.();
    timeline.pause();
    root.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps auto-fit text within logical dimensions at all four angles', () => {
    dispose = render(
      () => (
        <Text
          opts={{ text: 'Long rotated content', autofit: { maxSize: 30 } }}
          style={{}}
          timeline={timeline}
          onReady={() => {}}
        />
      ),
      root
    );
    const span = root.querySelector('span')!;
    for (const next of [0, 90, 180, 270]) {
      angle = next;
      root.dataset.castmillOrientation = String(next);
      window.dispatchEvent(new Event('resize'));
      const size = parseFloat(span.style.fontSize);
      expect(size).toBeGreaterThan(4.9);
      expect(size).toBeLessThanOrEqual(5);
    }
    width = 300;
    window.dispatchEvent(new Event('resize'));
    expect(parseFloat(span.style.fontSize)).toBeLessThanOrEqual(3);
  });

  it('recalculates a live scroller without duplicating timeline items or recreating content', async () => {
    dispose = render(
      () => (
        <Scroller
          config={{}}
          opts={{
            items: [{ name: 'a' }],
            direction: 'left',
            speed: 100,
            gap: '1em',
          }}
          style={{}}
          component={{ type: TemplateComponentType.Text } as never}
          resourceManager={{} as ResourceManager}
          globals={{}}
          timeline={timeline}
          onReady={() => {}}
        />
      ),
      root
    );
    await vi.advanceTimersByTimeAsync(100);
    const content = root.querySelector(
      '[data-component="scroller"]'
    )!.firstElementChild!;
    const mounted = content.firstElementChild;
    const entries = [...timeline.items, ...timeline.playing];
    expect(entries).toHaveLength(1);
    expect(entries[0].duration).toBe(3100);
    width = 300;
    angle = 90;
    root.dataset.castmillOrientation = '90';
    window.dispatchEvent(new Event('resize'));
    expect([...timeline.items, ...timeline.playing]).toHaveLength(1);
    expect(entries[0].duration).toBe(1600);
    expect(content.firstElementChild).toBe(mounted);
  });

  it('resizes pagination in logical axes and avoids rebuilding unchanged pages', async () => {
    dispose = render(
      () => (
        <PaginatedList
          config={{}}
          opts={{
            items: [{ name: 'a' }, { name: 'b' }],
            pageSize: 1,
            pageDuration: 2000,
          }}
          style={{}}
          component={{ type: TemplateComponentType.Text } as never}
          resourceManager={{} as ResourceManager}
          globals={{}}
          timeline={timeline}
          onReady={() => {}}
        />
      ),
      root
    );
    await vi.advanceTimersByTimeAsync(100);
    const container = root.querySelector(
      '[data-component="paginated-list"]'
    )!.firstElementChild!;
    const initialPage = container.firstElementChild;
    expect((container.firstElementChild as HTMLElement).style.width).toBe(
      '600px'
    );
    width = 300;
    angle = 90;
    root.dataset.castmillOrientation = '90';
    window.dispatchEvent(new Event('resize'));
    expect((container.firstElementChild as HTMLElement).style.width).toBe(
      '300px'
    );
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      '100px'
    );
    expect(container.firstElementChild).toBe(initialPage);
    const page = container.firstElementChild;
    window.dispatchEvent(new Event('resize'));
    expect(container.firstElementChild).toBe(page);
    expect([...timeline.items, ...timeline.playing]).toHaveLength(1);
  });
});
