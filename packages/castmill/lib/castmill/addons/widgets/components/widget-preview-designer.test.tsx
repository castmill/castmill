// @vitest-environment jsdom

import { fireEvent, render } from '@solidjs/testing-library';
import { JSX, createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetPreviewDesigner } from './widget-preview-designer';

const template = {
  type: 'group',
  name: 'root',
  components: [
    {
      type: 'text',
      name: 'headline',
      opts: { text: 'Hello' },
      style: {
        position: 'absolute',
        left: '10px',
        top: '20px',
        width: '100px',
        height: '50px',
      },
    },
  ],
};

describe('WidgetPreviewDesigner', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('selects, moves, and resizes rendered template components', () => {
    const onTransform = vi.fn();

    const Harness = () => {
      const [selectedPath, setSelectedPath] = createSignal<number[]>([]);
      return (
        <WidgetPreviewDesigner
          enabled
          template={template}
          selectedPath={selectedPath()}
          onSelect={setSelectedPath}
          onTransform={onTransform}
          moveLabel="Resize"
        >
          <div
            data-component="text"
            data-name="headline"
            style={template.components[0].style as JSX.CSSProperties}
          />
        </WidgetPreviewDesigner>
      );
    };

    const { container } = render(() => <Harness />);
    const canvas = container.querySelector(
      '.widget-editor__preview-designer'
    ) as HTMLElement;
    const component = container.querySelector(
      '[data-name="headline"]'
    ) as HTMLElement;

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 500, 300)
    );
    vi.spyOn(component, 'getBoundingClientRect').mockReturnValue(
      rect(10, 20, 100, 50)
    );
    Object.defineProperties(component, {
      offsetLeft: { value: 10 },
      offsetTop: { value: 20 },
      offsetWidth: { value: 100 },
      offsetHeight: { value: 50 },
    });

    fireEvent.pointerMove(component);
    fireEvent.click(component);

    const selection = container.querySelector(
      '.widget-editor__preview-selection'
    ) as HTMLElement;
    expect(selection).not.toBeNull();

    const moveHandle = container.querySelector(
      '.widget-editor__preview-selection-label'
    ) as HTMLElement;
    moveHandle.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    window.dispatchEvent(pointerEvent('pointermove', 30, 35));
    window.dispatchEvent(pointerEvent('pointerup', 30, 35));
    expect(onTransform).toHaveBeenCalledWith([0], {
      position: 'absolute',
      left: '30px',
      top: '35px',
    });

    const resizeHandle = container.querySelector(
      '.widget-editor__resize-handle--se'
    ) as HTMLElement;
    resizeHandle.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    window.dispatchEvent(pointerEvent('pointermove', 20, 10));
    window.dispatchEvent(pointerEvent('pointerup', 20, 10));
    expect(onTransform).toHaveBeenCalledWith([0], {
      width: '120px',
      height: '60px',
    });
  });
});

const rect = (
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const pointerEvent = (type: string, clientX: number, clientY: number) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
};
