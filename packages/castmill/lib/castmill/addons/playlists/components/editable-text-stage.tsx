import {
  Component,
  JSX,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Button } from '@castmill/ui-common';

import {
  EditableElementInfo,
  TextOverride,
  TextOverrides,
  readEditableElement,
} from './text-overrides';
import styles from './editable-text-stage.module.scss';

export interface EditableTextLabels {
  editAria: (label: string) => string;
  save: string;
  cancel: string;
  hide: string;
  reset: string;
  counter: (length: number, max: number) => string;
}

interface EditableTextStageProps {
  /** Edit mode: outlines editable texts and opens the editor on click. */
  active: boolean;
  overrides: TextOverrides;
  labels: EditableTextLabels;
  translateLabel: (label: string | undefined) => string | undefined;
  onChange: (key: string, value: TextOverride | undefined) => void;
  /** Called with the labels of the editable texts currently rendered. */
  onDiscover?: (labels: Map<string, string | undefined>) => void;
  children: JSX.Element;
}

const SELECTOR = '[data-editable-key]';
const MANAGED = 'data-editable-managed';
const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    : undefined;
const markPattern = (() => {
  try {
    return new RegExp('\\p{M}', 'u');
  } catch {
    return undefined;
  }
})();

const graphemeSegments = (value: string): string[] => {
  if (graphemeSegmenter) {
    return Array.from(
      graphemeSegmenter.segment(value),
      (part: { segment: string }) => part.segment
    );
  }

  const codePoints = Array.from(value);
  const segments: string[] = [];
  let joinNext = false;
  let regionalIndicators = 0;
  for (const codePoint of codePoints) {
    const character = codePoint.codePointAt(0)!;
    const isRegionalIndicator = character >= 0x1f1e6 && character <= 0x1f1ff;
    const previous = segments.length ? segments[segments.length - 1] : '';
    const isExtend =
      markPattern?.test(codePoint) ||
      /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe00-\ufe0f]/.test(
        codePoint
      ) ||
      (character >= 0x1f3fb && character <= 0x1f3ff) ||
      (character >= 0xe0020 && character <= 0xe007f);

    if (
      segments.length > 0 &&
      (isExtend ||
        joinNext ||
        codePoint === '\u200d' ||
        (codePoint === '\n' && previous.endsWith('\r')) ||
        (isRegionalIndicator && regionalIndicators % 2 === 1))
    ) {
      segments[segments.length - 1] += codePoint;
    } else {
      segments.push(codePoint);
    }

    joinNext = codePoint === '\u200d';
    regionalIndicators = isRegionalIndicator ? regionalIndicators + 1 : 0;
  }
  return segments;
};

const countGraphemes = (value: string): number =>
  graphemeSegments(value).length;

const truncateGraphemes = (value: string, maxLength: number): string =>
  graphemeSegments(value).slice(0, maxLength).join('');

interface OpenEditor {
  info: EditableElementInfo;
  value: string;
  top: number;
  left: number;
  width: number;
}

/**
 * Wraps the widget preview and lets users replace its editable texts in place.
 * The editor is anchored over the text instead of editing it directly, because
 * autofit would resize the text while typing.
 */
export const EditableTextStage: Component<EditableTextStageProps> = (props) => {
  let stageRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let editorRef: HTMLDivElement | undefined;
  let observer: MutationObserver | undefined;
  let scanScheduled = false;
  let lastDiscovered = '';
  let refocusKey: string | null = null;

  const [editor, setEditor] = createSignal<OpenEditor | null>(null);

  const label = (info: { key: string; label?: string }) =>
    props.translateLabel(info.label) || info.key;

  const editableElements = () =>
    stageRef
      ? Array.from(stageRef.querySelectorAll<HTMLElement>(SELECTOR))
      : [];

  const isInactivePage = (element: HTMLElement) =>
    !!element.closest('[aria-hidden="true"]') ||
    window.getComputedStyle(element).visibility === 'hidden';

  const scan = () => {
    scanScheduled = false;
    const discovered = new Map<string, string | undefined>();

    for (const element of editableElements()) {
      const info = readEditableElement(element);
      if (!info) continue;
      if (!discovered.has(info.key)) discovered.set(info.key, info.label);

      if (props.active && !isInactivePage(element)) {
        const name = label(info);
        element.setAttribute(MANAGED, '');
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', props.labels.editAria(name));
        element.setAttribute('title', name);
      } else if (element.hasAttribute(MANAGED)) {
        ['tabindex', 'role', 'aria-label', 'title', MANAGED].forEach((name) =>
          element.removeAttribute(name)
        );
      }
    }

    // The preview is rebuilt after each change: restore the focus to the text.
    if (refocusKey && props.active) {
      const target = editableElements().find(
        (element) =>
          element.getAttribute('data-editable-key') === refocusKey &&
          !isInactivePage(element)
      );
      if (target && !stageRef?.contains(document.activeElement)) {
        target.focus();
        refocusKey = null;
      }
    }

    const fingerprint = JSON.stringify(Array.from(discovered.entries()));
    if (fingerprint !== lastDiscovered) {
      lastDiscovered = fingerprint;
      props.onDiscover?.(discovered);
    }
  };

  const scheduleScan = () => {
    if (scanScheduled) return;
    scanScheduled = true;
    queueMicrotask(scan);
  };

  onMount(() => {
    const stage = stageRef;
    if (!stage) return;

    // Capture phase: clicks on texts must not reach the player.
    stage.addEventListener('click', onStageClick, true);
    // Native (not delegated) so handled keys never reach document listeners.
    stage.addEventListener('keydown', onStageKeyDown);
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver((mutations) => {
        if (
          !props.active &&
          mutations.every((mutation) => mutation.attributeName === 'style')
        ) {
          return;
        }
        scheduleScan();
      });
      observer.observe(stage, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'data-editable-key',
          'data-editable-label',
          'data-editable-overridden',
          'aria-hidden',
          'style',
        ],
      });
    }
    scan();
  });

  onCleanup(() => {
    observer?.disconnect();
    stageRef?.removeEventListener('click', onStageClick, true);
    stageRef?.removeEventListener('keydown', onStageKeyDown);
  });

  createEffect(
    on([() => props.active, () => props.labels], ([active]) => {
      scan();
      if (!active) setEditor(null);
    })
  );

  createEffect(() => {
    const current = editor();
    if (!current) return;
    queueMicrotask(() => {
      if (!editorRef) return;
      const editorRect = editorRef.getBoundingClientRect();
      const top = Math.max(
        8,
        Math.min(current.top, window.innerHeight - editorRect.height - 8)
      );
      if (top !== current.top) {
        setEditor((previous) =>
          previous?.info.key === current.info.key
            ? { ...previous, top }
            : previous
        );
      }
    });
  });

  const open = (element: HTMLElement) => {
    const info = readEditableElement(element);
    if (!info) return;
    const stored = props.overrides[info.key];
    const value =
      stored && 'text' in stored ? stored.text : stored ? '' : info.text;

    const rect = element.getBoundingClientRect();
    const viewportWidth = Math.max(window.innerWidth, 1);
    const width = Math.min(
      Math.max(rect.width, 280),
      Math.max(viewportWidth - 16, 1)
    );
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));

    setEditor({
      info,
      value,
      top: rect.bottom + 4,
      left: Number.isFinite(left) ? left : 0,
      width,
    });
    queueMicrotask(() => {
      inputRef?.focus();
      inputRef?.select();
    });
  };

  const close = () => {
    const current = editor();
    setEditor(null);
    if (current) {
      refocusKey = current.info.key;
      scheduleScan();
    }
  };

  const apply = (value: TextOverride | undefined) => {
    const current = editor();
    if (!current) return;
    props.onChange(current.info.key, value);
    close();
  };

  const save = () => {
    const current = editor();
    if (!current) return;
    // Saving the shown text unchanged would freeze its formatting: skip it.
    if (
      !props.overrides[current.info.key] &&
      current.value === current.info.text
    ) {
      close();
      return;
    }
    apply({ text: truncateGraphemes(current.value, current.info.maxLength) });
  };

  const onStageClick = (event: MouseEvent) => {
    if (!props.active) return;
    const target = (event.target as Element | null)?.closest?.(SELECTOR);
    if (
      target &&
      stageRef?.contains(target) &&
      !isInactivePage(target as HTMLElement)
    ) {
      event.preventDefault();
      event.stopPropagation();
      open(target as HTMLElement);
    }
  };

  const onStageKeyDown = (event: KeyboardEvent) => {
    if (!props.active || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = event.target as HTMLElement;
    if (
      target?.hasAttribute?.('data-editable-key') &&
      !isInactivePage(target)
    ) {
      // Space would otherwise also toggle the preview playback.
      event.preventDefault();
      event.stopPropagation();
      open(target);
    }
  };

  // Escape closes the editor before the surrounding dialog sees it.
  createEffect(() => {
    if (!editor()) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    onCleanup(() => window.removeEventListener('keydown', onKey, true));
  });

  const onEditorKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter') {
      return;
    }
    const multiline = editor()?.info.multiline;
    if (!multiline || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      save();
    }
  };

  const nearLimit = () => {
    const current = editor();
    return (
      !!current && countGraphemes(current.value) >= current.info.maxLength * 0.8
    );
  };

  return (
    <div
      ref={stageRef}
      class={styles.stage}
      classList={{ [styles.editing]: props.active }}
    >
      {props.children}

      <Portal>
        <Show when={editor()}>
          {(current) => (
            <div
              ref={(el) => (editorRef = el)}
              class={styles.editor}
              role="dialog"
              data-modal-overlay
              aria-label={props.labels.editAria(label(current().info))}
              style={{
                top: `${current().top}px`,
                left: `${current().left}px`,
                width: `${current().width}px`,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <label class={styles.editorLabel} for="editable-text-input">
                {label(current().info)}
              </label>
              <Show
                when={current().info.multiline}
                fallback={
                  <input
                    id="editable-text-input"
                    ref={(el) => (inputRef = el)}
                    class={styles.input}
                    type="text"
                    value={current().value}
                    onInput={(event) =>
                      setEditor({
                        ...current(),
                        value: truncateGraphemes(
                          event.currentTarget.value,
                          current().info.maxLength
                        ),
                      })
                    }
                    onKeyDown={onEditorKeyDown}
                  />
                }
              >
                <textarea
                  id="editable-text-input"
                  ref={(el) => (inputRef = el)}
                  class={styles.input}
                  rows={3}
                  value={current().value}
                  onInput={(event) =>
                    setEditor({
                      ...current(),
                      value: truncateGraphemes(
                        event.currentTarget.value,
                        current().info.maxLength
                      ),
                    })
                  }
                  onKeyDown={onEditorKeyDown}
                />
              </Show>
              <Show when={nearLimit()}>
                <div class={styles.counter} aria-live="polite">
                  {props.labels.counter(
                    countGraphemes(current().value),
                    current().info.maxLength
                  )}
                </div>
              </Show>
              <div class={styles.actions}>
                <Button
                  label={props.labels.save}
                  color="primary"
                  onClick={save}
                />
                <Button
                  label={props.labels.cancel}
                  color="secondary"
                  onClick={close}
                />
                <Button
                  label={props.labels.hide}
                  color="secondary"
                  onClick={() => apply({ hidden: true })}
                />
                <Show when={props.overrides[current().info.key]}>
                  <Button
                    label={props.labels.reset}
                    color="danger"
                    onClick={() => apply(undefined)}
                  />
                </Show>
              </div>
            </div>
          )}
        </Show>
      </Portal>
    </div>
  );
};
