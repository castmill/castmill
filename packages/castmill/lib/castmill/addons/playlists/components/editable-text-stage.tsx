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

  const scan = () => {
    scanScheduled = false;
    const discovered = new Map<string, string | undefined>();

    for (const element of editableElements()) {
      const info = readEditableElement(element);
      if (!info) continue;
      if (!discovered.has(info.key)) discovered.set(info.key, info.label);

      if (props.active) {
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
        (element) => element.getAttribute('data-editable-key') === refocusKey
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
    // Capture phase: clicks on texts must not reach the player.
    stageRef?.addEventListener('click', onStageClick, true);
    // Native (not delegated) so handled keys never reach document listeners.
    stageRef?.addEventListener('keydown', onStageKeyDown);
    if (typeof MutationObserver !== 'undefined' && stageRef) {
      observer = new MutationObserver(scheduleScan);
      observer.observe(stageRef, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'data-editable-key',
          'data-editable-label',
          'data-editable-overridden',
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
    if (!info || !stageRef) return;
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
    apply({ text: current.value.slice(0, current.info.maxLength) });
  };

  const onStageClick = (event: MouseEvent) => {
    if (!props.active) return;
    const target = (event.target as Element | null)?.closest?.(SELECTOR);
    if (target && stageRef?.contains(target)) {
      event.preventDefault();
      event.stopPropagation();
      open(target as HTMLElement);
    }
  };

  const onStageKeyDown = (event: KeyboardEvent) => {
    if (!props.active || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = event.target as HTMLElement;
    if (target?.hasAttribute?.('data-editable-key')) {
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
    return !!current && current.value.length >= current.info.maxLength * 0.8;
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
                    maxLength={current().info.maxLength}
                    onInput={(event) =>
                      setEditor({
                        ...current(),
                        value: event.currentTarget.value,
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
                  maxLength={current().info.maxLength}
                  onInput={(event) =>
                    setEditor({
                      ...current(),
                      value: event.currentTarget.value,
                    })
                  }
                  onKeyDown={onEditorKeyDown}
                />
              </Show>
              <Show when={nearLimit()}>
                <div class={styles.counter} aria-live="polite">
                  {props.labels.counter(
                    current().value.length,
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
