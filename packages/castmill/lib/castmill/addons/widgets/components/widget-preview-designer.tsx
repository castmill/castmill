import {
  Component,
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';

type TemplateNode = Record<string, any>;

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WidgetPreviewDesignerProps {
  enabled: boolean;
  template: TemplateNode;
  selectedPath: number[];
  onSelect: (path: number[]) => void;
  onTransform: (path: number[], style: Record<string, string>) => void;
  children: JSX.Element;
  moveLabel: string;
}

const componentChildren = (node: TemplateNode): TemplateNode[] => {
  if (Array.isArray(node.components)) return node.components;
  return node.component ? [node.component] : [];
};

const findPath = (
  node: TemplateNode,
  name: string,
  type: string,
  path: number[] = []
): number[] | null => {
  if (node.name === name && node.type === type) return path;
  for (let index = 0; index < componentChildren(node).length; index++) {
    const match = findPath(componentChildren(node)[index], name, type, [
      ...path,
      index,
    ]);
    if (match) return match;
  }
  return null;
};

const nodeAtPath = (
  node: TemplateNode,
  path: number[]
): TemplateNode | undefined =>
  path.reduce<TemplateNode | undefined>(
    (current, index) =>
      current ? componentChildren(current)[index] : undefined,
    node
  );

export const WidgetPreviewDesigner: Component<WidgetPreviewDesignerProps> = (
  props
) => {
  let canvas: HTMLDivElement | undefined;
  let scheduledFrame: number | undefined;
  let stopTransform: (() => void) | undefined;
  const [hovered, setHovered] = createSignal<Bounds | null>(null);
  const [selected, setSelected] = createSignal<Bounds | null>(null);
  const [selectedElement, setSelectedElement] = createSignal<HTMLElement>();

  const measure = (element: HTMLElement): Bounds => {
    const canvasRect = canvas!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - canvasRect.left,
      top: rect.top - canvasRect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const renderedComponent = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const element = target.closest<HTMLElement>('[data-component][data-name]');
    return element && canvas?.contains(element) ? element : undefined;
  };

  const selectElement = (element: HTMLElement) => {
    const path = findPath(
      props.template,
      element.dataset.name || '',
      element.dataset.component || ''
    );
    if (!path) return;
    setSelectedElement(element);
    setSelected(measure(element));
    props.onSelect(path);
  };

  const refreshSelection = () => {
    if (!props.enabled || !canvas) {
      setSelected(null);
      return;
    }
    const node = nodeAtPath(props.template, props.selectedPath);
    if (!node) return setSelected(null);
    const element = Array.from(
      canvas.querySelectorAll<HTMLElement>('[data-component][data-name]')
    ).find(
      (candidate) =>
        candidate.dataset.name === node.name &&
        candidate.dataset.component === node.type
    );
    setSelectedElement(element);
    setSelected(element ? measure(element) : null);
  };

  createEffect(() => {
    props.enabled;
    props.template;
    props.selectedPath;
    if (scheduledFrame !== undefined) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(refreshSelection);
  });

  const captureClick = (event: MouseEvent) => {
    if (!props.enabled) return;
    const element = renderedComponent(event.target);
    if (element) {
      event.preventDefault();
      event.stopPropagation();
      selectElement(element);
    }
  };

  onMount(() => canvas?.addEventListener('click', captureClick, true));

  const beginTransform = (
    event: PointerEvent,
    mode: 'move' | 'resize',
    horizontal = 1,
    vertical = 1
  ) => {
    stopTransform?.();
    const element = selectedElement();
    const path = [...props.selectedPath];
    const bounds = selected();
    if (!element || !bounds) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const computed = getComputedStyle(element);
    const offsetLeft = element.offsetLeft;
    const offsetTop = element.offsetTop;
    const startLeft = Number.isFinite(parseFloat(computed.left))
      ? parseFloat(computed.left)
      : offsetLeft;
    const startTop = Number.isFinite(parseFloat(computed.top))
      ? parseFloat(computed.top)
      : offsetTop;
    const startWidth = element.offsetWidth || bounds.width;
    const startHeight = element.offsetHeight || bounds.height;

    const move = (pointerEvent: PointerEvent) => {
      const deltaX = pointerEvent.clientX - startX;
      const deltaY = pointerEvent.clientY - startY;
      if (mode === 'move') {
        const left = Math.round(startLeft + deltaX);
        const top = Math.round(startTop + deltaY);
        props.onTransform(path, {
          position:
            computed.position === 'static' ? 'absolute' : computed.position,
          left: `${left}px`,
          top: `${top}px`,
        });
        setSelected({
          ...bounds,
          left: bounds.left + deltaX,
          top: bounds.top + deltaY,
        });
      } else {
        const width = Math.max(8, Math.round(startWidth + deltaX * horizontal));
        const height = Math.max(8, Math.round(startHeight + deltaY * vertical));
        const style: Record<string, string> = {
          width: `${width}px`,
          height: `${height}px`,
        };
        if (horizontal < 0) style.left = `${startLeft + deltaX}px`;
        if (vertical < 0) style.top = `${startTop + deltaY}px`;
        props.onTransform(path, style);
        setSelected({
          left: horizontal < 0 ? bounds.left + deltaX : bounds.left,
          top: vertical < 0 ? bounds.top + deltaY : bounds.top,
          width,
          height,
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      stopTransform = undefined;
    };
    const end = () => {
      cleanup();
      requestAnimationFrame(refreshSelection);
    };
    stopTransform = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };

  onCleanup(() => {
    canvas?.removeEventListener('click', captureClick, true);
    if (scheduledFrame !== undefined) cancelAnimationFrame(scheduledFrame);
    stopTransform?.();
    setSelectedElement(undefined);
  });

  return (
    <div
      ref={canvas}
      class="widget-editor__preview-designer"
      onPointerMove={(event) => {
        if (!props.enabled) return;
        const element = renderedComponent(event.target);
        setHovered(element ? measure(element) : null);
      }}
      onPointerLeave={() => setHovered(null)}
    >
      {props.children}
      <Show when={props.enabled && hovered()}>
        <div
          class="widget-editor__preview-hover"
          style={boundsStyle(hovered()!)}
        />
      </Show>
      <Show when={props.enabled && selected()}>
        <div
          class="widget-editor__preview-selection"
          style={boundsStyle(selected()!)}
        >
          <button
            type="button"
            class="widget-editor__preview-selection-label"
            onPointerDown={(event) => beginTransform(event, 'move')}
          >
            {nodeAtPath(props.template, props.selectedPath)?.name ||
              props.moveLabel}
          </button>
          <For
            each={
              [
                ['nw', -1, -1],
                ['ne', 1, -1],
                ['sw', -1, 1],
                ['se', 1, 1],
              ] as const
            }
          >
            {([corner, horizontal, vertical]) => (
              <button
                type="button"
                class={`widget-editor__resize-handle widget-editor__resize-handle--${corner}`}
                aria-label={`${props.moveLabel} ${corner}`}
                onPointerDown={(event) =>
                  beginTransform(event, 'resize', horizontal, vertical)
                }
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

const boundsStyle = (bounds: Bounds): JSX.CSSProperties => ({
  left: `${bounds.left}px`,
  top: `${bounds.top}px`,
  width: `${bounds.width}px`,
  height: `${bounds.height}px`,
});
