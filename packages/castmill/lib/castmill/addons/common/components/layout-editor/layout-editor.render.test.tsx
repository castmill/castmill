import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutOptionValue } from '@castmill/player';
import { LayoutEditor, STACKED_MAX_WIDTH_EM } from './layout-editor';

const t = (key: string, params?: Record<string, any>) =>
  params ? `${key}:${JSON.stringify(params)}` : `tr:${key}`;

type Rect = { left: number; top: number; width: number; height: number };

let resizeCallback: (() => void) | undefined;
const observe = vi.fn();
const disconnect = vi.fn();
let editorWidth = 1000;
const canvasRect: Rect = { left: 0, top: 0, width: 400, height: 225 };

const rectFor = (el: Element): DOMRect => {
  let rect: Rect = { left: 0, top: 0, width: 0, height: 0 };
  if (el.classList.contains('layout-editor')) {
    rect = { left: 0, top: 0, width: editorWidth, height: 500 };
  } else if (el.classList.contains('layout-editor__canvas-container')) {
    rect = { left: 0, top: 0, width: 440, height: 300 };
  } else if (el.classList.contains('layout-editor__canvas')) {
    rect = canvasRect;
  }
  return {
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => rect,
  } as DOMRect;
};

const initialValue = (): LayoutOptionValue => ({
  aspectRatio: '16:9',
  zones: [
    {
      id: 'a',
      name: 'Main',
      rect: { x: 10, y: 10, width: 30, height: 30 },
      zIndex: 1,
    },
  ],
});

const renderEditor = (value = initialValue(), withT = true) => {
  const [layout, setLayout] = createSignal(value);
  const onChange = vi.fn((next: LayoutOptionValue) => setLayout(next));
  const result = render(() => (
    <LayoutEditor
      value={layout()}
      onChange={onChange}
      t={withT ? t : undefined}
    />
  ));
  return { ...result, layout, onChange };
};

const pointer = (
  type: string,
  init: {
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    isPrimary?: boolean;
    pointerType?: string;
    button?: number;
  } = {}
) => {
  // jsdom has no PointerEvent constructor; extend a MouseEvent instead.
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    isPrimary: { value: init.isPrimary ?? true },
    pointerType: { value: init.pointerType ?? 'touch' },
  });
  return event;
};

const zoneEl = (container: HTMLElement, id = 'a') =>
  container.querySelector(`[data-zone-id="${id}"]`) as HTMLElement;

beforeEach(() => {
  editorWidth = 1000;
  resizeCallback = undefined;
  observe.mockClear();
  disconnect.mockClear();
  global.ResizeObserver = vi.fn((callback: () => void) => {
    resizeCallback = callback;
    return { observe, disconnect, unobserve: vi.fn() };
  }) as any;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return rectFor(this);
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LayoutEditor responsive layout', () => {
  it('keeps the sidebar beside the canvas when the editor is wide', () => {
    const { container } = renderEditor();
    const root = container.querySelector('.layout-editor')!;
    expect(root).not.toHaveClass('layout-editor--stacked');
    expect(observe).toHaveBeenCalledWith(root);
    expect(observe).toHaveBeenCalledWith(
      container.querySelector('.layout-editor__canvas-container')
    );
  });

  it('stacks the sidebar below the canvas when the editor is narrow', () => {
    editorWidth = STACKED_MAX_WIDTH_EM * 16 - 1;
    const { container } = renderEditor();
    expect(container.querySelector('.layout-editor')).toHaveClass(
      'layout-editor--stacked'
    );
  });

  it('follows the editor width, not the viewport, on resize', () => {
    const { container } = renderEditor();
    const root = container.querySelector('.layout-editor')!;

    editorWidth = 375;
    resizeCallback?.();
    expect(root).toHaveClass('layout-editor--stacked');

    editorWidth = 0; // hidden: keep the last decision
    resizeCallback?.();
    expect(root).toHaveClass('layout-editor--stacked');

    editorWidth = 1200;
    resizeCallback?.();
    expect(root).not.toHaveClass('layout-editor--stacked');
  });

  it('sizes the canvas from its container and the viewport height', () => {
    const innerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 200,
    });
    const { container } = renderEditor();
    window.dispatchEvent(new Event('resize'));
    const canvas = container.querySelector(
      '.layout-editor__canvas'
    ) as HTMLElement;
    // 60% of a 200px viewport limits the 16:9 canvas height to 120px
    expect(canvas.style.height).toBe('120px');
    expect(canvas.getAttribute('dir')).toBe('ltr');
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: innerHeight,
    });
  });

  it('disconnects the ResizeObserver on unmount', () => {
    const { unmount } = renderEditor();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('works without ResizeObserver', () => {
    (global as any).ResizeObserver = undefined;
    editorWidth = 300;
    const { container } = renderEditor();
    expect(container.querySelector('.layout-editor')).toHaveClass(
      'layout-editor--stacked'
    );
  });
});

describe('LayoutEditor pointer interactions', () => {
  it('moves a zone with a touch drag', () => {
    const { container, onChange, layout } = renderEditor();
    const zone = zoneEl(container);

    // Start at 20% / 20% of the 400x225 canvas
    zone.dispatchEvent(pointer('pointerdown', { clientX: 80, clientY: 45 }));
    document.dispatchEvent(
      pointer('pointermove', { clientX: 160, clientY: 90 })
    );
    document.dispatchEvent(pointer('pointerup', { clientX: 160, clientY: 90 }));

    expect(onChange).toHaveBeenCalled();
    // Moved by +20% / +20%
    expect(layout().zones[0].rect).toEqual({
      x: 30,
      y: 30,
      width: 30,
      height: 30,
    });

    // Listeners are removed after pointerup
    onChange.mockClear();
    document.dispatchEvent(
      pointer('pointermove', { clientX: 300, clientY: 200 })
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resizes a zone from a handle and ends on pointercancel', () => {
    const { container, layout, onChange } = renderEditor();
    fireEvent.click(zoneEl(container));
    const handle = container.querySelector('[data-handle="se"]') as HTMLElement;
    expect(handle).toBeTruthy();

    // Grab away from the bottom-right edge, then move by +10% / +20%.
    handle.dispatchEvent(
      pointer('pointerdown', { clientX: 140, clientY: 67.5 })
    );
    document.dispatchEvent(
      pointer('pointermove', { clientX: 180, clientY: 112.5 })
    );
    expect(layout().zones[0].rect).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 50,
    });

    document.dispatchEvent(pointer('pointercancel'));
    onChange.mockClear();
    document.dispatchEvent(
      pointer('pointermove', { clientX: 300, clientY: 200 })
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resizes an aspect-locked zone from an off-center handle grab', () => {
    const { container, layout } = renderEditor();
    fireEvent.click(zoneEl(container));
    fireEvent.change(
      container.querySelector(
        '.layout-editor__zone-aspect-select'
      ) as HTMLSelectElement,
      { target: { value: '16:9' } }
    );

    const handle = container.querySelector('[data-handle="se"]') as HTMLElement;
    handle.dispatchEvent(
      pointer('pointerdown', { clientX: 140, clientY: 67.5 })
    );
    document.dispatchEvent(
      pointer('pointermove', { clientX: 180, clientY: 112.5 })
    );

    expect(layout().zones[0].rect).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    });
  });

  it('ignores secondary pointers and other pointer ids', () => {
    const { container, onChange } = renderEditor();
    const zone = zoneEl(container);

    zone.dispatchEvent(
      pointer('pointerdown', { isPrimary: false, clientX: 80, clientY: 45 })
    );
    zone.dispatchEvent(
      pointer('pointerdown', { pointerType: 'mouse', button: 2 })
    );
    document.dispatchEvent(pointer('pointermove', { clientX: 200 }));
    expect(onChange).not.toHaveBeenCalled();

    zone.dispatchEvent(
      pointer('pointerdown', { pointerId: 7, clientX: 80, clientY: 45 })
    );
    // Another primary pointer cannot take over or end the active drag.
    zone.dispatchEvent(
      pointer('pointerdown', {
        pointerId: 8,
        pointerType: 'mouse',
        clientX: 160,
        clientY: 90,
      })
    );
    document.dispatchEvent(
      pointer('pointermove', { pointerId: 8, clientX: 200, clientY: 45 })
    );
    document.dispatchEvent(pointer('pointerup', { pointerId: 8 }));
    expect(onChange).not.toHaveBeenCalled();
    document.dispatchEvent(
      pointer('pointermove', { pointerId: 7, clientX: 120, clientY: 45 })
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    document.dispatchEvent(pointer('pointerup', { pointerId: 7 }));
  });
});

describe('LayoutEditor localization', () => {
  it('renders localized labels and tooltips', () => {
    const { container } = renderEditor();

    expect(screen.getByText('tr:layouts.editor.size')).toBeInTheDocument();
    expect(screen.getAllByText('tr:layouts.editor.width').length).toBe(2);
    expect(screen.getAllByText('tr:layouts.editor.height').length).toBe(2);
    expect(screen.getByText('tr:layouts.editor.zoneRatio')).toBeInTheDocument();
    expect(screen.getByText('tr:layouts.editor.none')).toBeInTheDocument();
    expect(
      screen.getByText('tr:layouts.editor.noSelection')
    ).toBeInTheDocument();
    expect(
      screen.getByText('layouts.editor.zonesHeading:{"count":1}')
    ).toBeInTheDocument();
    expect(
      screen.getByText('layouts.editor.layer:{"value":1}')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'tr:layouts.addZone' })
    ).toBeInTheDocument();
    expect(
      container
        .querySelector('.layout-editor__quick-btn')!
        .getAttribute('title')
    ).toBe('tr:layouts.editor.selectZoneFirst');
  });

  it('localizes templates, distribute actions and default zone names', () => {
    const { layout } = renderEditor();
    fireEvent.click(
      screen.getByRole('button', { name: 'tr:layouts.templates' })
    );

    expect(
      screen.getByText('tr:layouts.editor.templates.pictureInPicture')
    ).toBeInTheDocument();
    expect(
      screen.getByText('tr:layouts.editor.distributeColumns')
    ).toBeInTheDocument();
    expect(
      screen.getByText('tr:layouts.editor.distributeRows')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('tr:layouts.editor.templates.twoColumns'));
    expect(layout().zones.map((z) => z.name)).toEqual([
      'layouts.editor.zoneName:{"number":1}',
      'layouts.editor.zoneName:{"number":2}',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'tr:layouts.addZone' }));
    expect(layout().zones[2].name).toBe('layouts.editor.zoneName:{"number":3}');
  });

  it('shows localized properties for the selected zone', () => {
    const { container } = renderEditor();
    fireEvent.click(
      container.querySelector('.layout-editor__zone-item') as HTMLElement
    );

    expect(screen.getByText('tr:layouts.zoneProperties')).toBeInTheDocument();
    expect(
      screen.getByText('tr:layouts.editor.widthShort')
    ).toBeInTheDocument();
    expect(
      screen.getByText('tr:layouts.editor.heightShort')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'tr:layouts.editor.deleteZone' })
    ).toBeInTheDocument();
    expect(
      container
        .querySelector('.layout-editor__quick-btn')!
        .getAttribute('title')
    ).toBe('tr:layouts.editor.fillWidth');
    expect(
      container
        .querySelector('.layout-editor__fraction-btn')!
        .getAttribute('title')
    ).toBe('layouts.editor.setWidth:{"size":"100%"}');
  });

  it('falls back to keys without a translation function', () => {
    renderEditor(initialValue(), false);
    expect(screen.getByText('layouts.editor.size')).toBeInTheDocument();
  });
});
