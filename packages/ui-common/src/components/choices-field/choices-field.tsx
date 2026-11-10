import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { BsChevronLeft, BsChevronRight, BsPlusLg, BsXLg } from 'solid-icons/bs';

import { Button } from '../button/button';
import { Modal, ModalRef } from '../modal/modal';
import { Choice, ChoiceVisual } from './choice-visual';
import styles from './choices-field.module.scss';

export type { Choice, ChoicePreview } from './choice-visual';
export { ChoiceVisual, FONT_SAMPLE, loadPreviewFont } from './choice-visual';

export type ChoicesDisplay = 'list' | 'cards' | 'grid';

export interface ChoicesPage {
  items: Choice[];
  next: string | null;
}

export interface ChoicesRequest {
  query: string;
  cursor: string | null;
  /** The currently selected values, so the provider can return them first. */
  values: string[];
}

export interface ChoicesFieldLabels {
  choose: string;
  change: string;
  add: string;
  clear: string;
  remove: string;
  moveBefore: string;
  moveAfter: string;
  search: string;
  loadMore: string;
  retry: string;
  noResults: string;
  noSelection: string;
  unavailable: string;
  selectAll: string;
  selectNone: string;
  selected: (count: number, max?: number) => string;
  done: string;
  cancel: string;
  play: string;
  stop: string;
  enlarge: string;
  close: string;
  dialogDescription: string;
}

export interface ChoicesFieldProps {
  id: string;
  label: string;
  description?: string;
  value?: string | string[] | null;
  multiple?: boolean;
  ordered?: boolean;
  min?: number;
  max?: number;
  display?: ChoicesDisplay;
  search?: boolean;
  required?: boolean;
  /** Disables the field, e.g. until the fields it depends on are set. */
  disabled?: boolean;
  disabledHint?: string;
  /** Shown when a multiple selection is empty. */
  emptyHint?: string;
  /** Changing it reloads the details of the selected values. */
  reloadKey?: string;
  labels: ChoicesFieldLabels;
  loadChoices: (request: ChoicesRequest) => Promise<ChoicesPage>;
  errorMessage: (error: unknown) => string;
  onChange: (value: string | string[] | undefined) => void;
  searchDebounceMs?: number;
}

const toValues = (value: ChoicesFieldProps['value']): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string' && v !== '');
  }
  return typeof value === 'string' && value !== '' ? [value] : [];
};

const mergeUnique = (items: Choice[], more: Choice[]) => {
  const seen = new Set(items.map((item) => item.value));
  return items.concat(more.filter((item) => !seen.has(item.value)));
};

/**
 * Form field whose values are chosen from a list provided by an integration
 * (e.g. listings or photos). Stores plain string values.
 */
export const ChoicesField: Component<ChoicesFieldProps> = (props) => {
  const display = () => props.display || 'list';
  const selected = () => toValues(props.value);

  const [known, setKnown] = createSignal<Map<string, Choice>>(new Map());
  const [lookedUp, setLookedUp] = createSignal<Set<string>>(new Set());
  const [resolving, setResolving] = createSignal(false);
  const [resolveError, setResolveError] = createSignal<unknown>(null);

  const remember = (items: Choice[]) => {
    if (items.length === 0) return;
    setKnown((prev) => {
      const next = new Map(prev);
      items.forEach((item) => next.set(item.value, item));
      return next;
    });
  };

  let resolveId = 0;
  const resolveSelected = async () => {
    const values = selected();
    const missing = values.filter((v) => !known().has(v) && !lookedUp().has(v));
    if (props.disabled || missing.length === 0) return;

    const id = ++resolveId;
    setResolving(true);
    setResolveError(null);
    try {
      const page = await props.loadChoices({
        query: '',
        cursor: null,
        values,
      });
      if (id !== resolveId) return;
      remember(page.items);
      setLookedUp((prev) => new Set([...prev, ...values]));
    } catch (error) {
      if (id === resolveId) setResolveError(error);
    } finally {
      if (id === resolveId) setResolving(false);
    }
  };

  createEffect(
    on(
      () => props.reloadKey,
      () => {
        resolveId++;
        setKnown(new Map());
        setLookedUp(new Set<string>());
        setResolving(false);
      },
      { defer: true }
    )
  );

  createEffect(
    on([selected, () => props.reloadKey, () => props.disabled], () => {
      resolveSelected();
    })
  );

  const stateOf = (value: string) => {
    const choice = known().get(value);
    if (choice) return { choice };
    if (lookedUp().has(value)) return { unavailable: true };
    return { loading: true };
  };

  // Dialog state
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [items, setItems] = createSignal<Choice[]>([]);
  const [next, setNext] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<unknown>(null);
  const [draft, setDraft] = createSignal<string[]>([]);
  const [enlarged, setEnlarged] = createSignal<Choice | null>(null);
  let modalRef: ModalRef | undefined;
  let resultsRef: HTMLDivElement | null = null;
  let pageId = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // Escape closes the enlarged image before the dialog's own Escape handler
  // (registered on document in the capture phase) can close the dialog.
  createEffect(() => {
    if (!enlarged()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setEnlarged(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    onCleanup(() => window.removeEventListener('keydown', onKey, true));
  });

  const loadPage = async (reset: boolean) => {
    const id = ++pageId;
    setLoading(true);
    setError(null);
    if (reset) {
      setItems([]);
      setNext(null);
    }
    try {
      const page = await props.loadChoices({
        query: query(),
        cursor: reset ? null : next(),
        values: selected(),
      });
      if (id !== pageId) return;
      remember(page.items);
      setItems((prev) => (reset ? page.items : mergeUnique(prev, page.items)));
      setNext(page.next || null);
    } catch (err) {
      if (id === pageId) setError(err);
    } finally {
      if (id === pageId) setLoading(false);
    }
  };

  const openDialog = () => {
    if (props.disabled) return;
    setQuery('');
    setItems([]);
    setNext(null);
    setDraft(selected());
    setEnlarged(null);
    setOpen(true);
    loadPage(true);
  };

  const closeDialog = () => {
    pageId++;
    if (searchTimer) clearTimeout(searchTimer);
    if (modalRef) {
      modalRef.close();
    } else {
      setOpen(false);
    }
  };

  onCleanup(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  const onSearch = (text: string) => {
    setQuery(text);
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => loadPage(true),
      props.searchDebounceMs ?? 300
    );
  };

  const atMax = () =>
    typeof props.max === 'number' && draft().length >= props.max;

  const belowMin = () =>
    typeof props.min === 'number' && draft().length < props.min;

  const toggle = (choice: Choice) => {
    if (choice.disabled) return;
    if (!props.multiple) {
      props.onChange(choice.value);
      closeDialog();
      return;
    }
    const current = draft();
    if (current.includes(choice.value)) {
      setDraft(current.filter((v) => v !== choice.value));
    } else if (!atMax()) {
      setDraft([...current, choice.value]);
    }
  };

  const selectAll = () => {
    const current = draft();
    const additions = items()
      .filter((item) => !item.disabled && !current.includes(item.value))
      .map((item) => item.value);
    const room =
      typeof props.max === 'number'
        ? Math.max(props.max - current.length, 0)
        : additions.length;
    setDraft([...current, ...additions.slice(0, room)]);
  };

  const applyDraft = () => {
    props.onChange(draft());
    closeDialog();
  };

  // Selection editing (multiple)
  const removeValue = (value: string) => {
    if (props.multiple) {
      props.onChange(selected().filter((v) => v !== value));
    } else {
      props.onChange(undefined);
    }
  };

  const move = (from: number, to: number) => {
    const values = [...selected()];
    if (to < 0 || to >= values.length || from === to) return;
    const [moved] = values.splice(from, 1);
    values.splice(to, 0, moved);
    props.onChange(values);
  };

  let dragIndex: number | null = null;

  // Arrow keys move the focus between results; up/down skip a row in grids.
  const onResultsKeyDown = (e: KeyboardEvent) => {
    const keys = [
      'ArrowRight',
      'ArrowLeft',
      'ArrowDown',
      'ArrowUp',
      'Home',
      'End',
    ];
    if (!resultsRef || !keys.includes(e.key)) return;
    const options = Array.from(
      resultsRef.querySelectorAll<HTMLElement>('[role="option"]')
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;

    let columns = 1;
    if (display() === 'grid') {
      const top = options[0].offsetTop;
      columns = Math.max(
        options.filter((option) => option.offsetTop === top).length,
        1
      );
    }

    const target = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      Home: 0,
      End: options.length - 1,
    }[e.key]!;

    if (target >= 0 && target < options.length) {
      e.preventDefault();
      options[target].focus();
    }
  };

  const visualLabels = () => ({
    play: props.labels.play,
    stop: props.labels.stop,
    enlarge: props.labels.enlarge,
  });

  const position = (value: string) => draft().indexOf(value) + 1;

  const selectionTile = (value: string, index: () => number) => {
    const state = () => stateOf(value);
    return (
      <li
        class={styles.tile}
        classList={{ [styles.unavailable]: !!state().unavailable }}
        draggable={props.ordered && !props.disabled}
        onDragStart={() => (dragIndex = index())}
        onDragOver={(e) => props.ordered && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragIndex !== null) move(dragIndex, index());
          dragIndex = null;
        }}
        data-testid="selected-tile"
      >
        <Show when={props.ordered}>
          <span class={styles.badge}>{index() + 1}</span>
        </Show>
        <Show when={state().choice}>
          <ChoiceVisual choice={state().choice!} labels={visualLabels()} />
          <span class={styles.tileLabel}>{state().choice!.label}</span>
        </Show>
        <Show when={state().unavailable}>
          <span class={styles.unavailableText}>{props.labels.unavailable}</span>
        </Show>
        <Show when={state().loading}>
          <span class={styles.skeleton} aria-hidden="true" />
        </Show>
        <span class={styles.tileActions}>
          <Show when={props.ordered}>
            <button
              type="button"
              aria-label={props.labels.moveBefore}
              title={props.labels.moveBefore}
              disabled={props.disabled || index() === 0}
              onClick={() => move(index(), index() - 1)}
            >
              <BsChevronLeft />
            </button>
            <button
              type="button"
              aria-label={props.labels.moveAfter}
              title={props.labels.moveAfter}
              disabled={props.disabled || index() === selected().length - 1}
              onClick={() => move(index(), index() + 1)}
            >
              <BsChevronRight />
            </button>
          </Show>
          <button
            type="button"
            aria-label={props.labels.remove}
            title={props.labels.remove}
            disabled={props.disabled}
            onClick={() => removeValue(value)}
          >
            <BsXLg />
          </button>
        </span>
      </li>
    );
  };

  const singleSelection = () => {
    const value = () => selected()[0];
    const state = () => (value() ? stateOf(value()) : null);
    return (
      <div class={styles.card} data-testid="single-selection">
        <Show when={!value()}>
          <span class={styles.muted}>{props.labels.noSelection}</span>
        </Show>
        <Show when={state()?.choice}>
          <Show when={display() !== 'list'}>
            <ChoiceVisual choice={state()!.choice!} labels={visualLabels()} />
          </Show>
          <span class={styles.text}>
            <span class={styles.label}>{state()!.choice!.label}</span>
            <Show when={state()!.choice!.description}>
              <span class={styles.description}>
                {state()!.choice!.description}
              </span>
            </Show>
          </span>
        </Show>
        <Show when={state()?.unavailable}>
          <span class={styles.unavailableText}>{props.labels.unavailable}</span>
        </Show>
        <Show when={state()?.loading}>
          <span class={styles.skeleton} aria-hidden="true" />
        </Show>
      </div>
    );
  };

  return (
    <div class={styles.field} data-testid={`choices-field-${props.id}`}>
      <div class={styles.header}>
        <label id={`${props.id}-label`}>{props.label}</label>
        <span class={styles.actions}>
          <Show
            when={!props.multiple && selected().length > 0 && !props.required}
          >
            <Button
              label={props.labels.clear}
              color="secondary"
              disabled={props.disabled}
              onClick={() => props.onChange(undefined)}
            />
          </Show>
          <Button
            label={
              props.multiple
                ? props.labels.add
                : selected().length > 0
                  ? props.labels.change
                  : props.labels.choose
            }
            icon={props.multiple ? BsPlusLg : undefined}
            color="primary"
            disabled={props.disabled}
            onClick={openDialog}
            aria-describedby={`${props.id}-label`}
          />
        </span>
      </div>

      <Show when={props.description}>
        <div class={styles.description}>{props.description}</div>
      </Show>

      <Show when={props.disabled && props.disabledHint}>
        <div class={styles.hint} role="note">
          {props.disabledHint}
        </div>
      </Show>

      <Show when={resolveError()}>
        <div class={styles.error} role="alert">
          {props.errorMessage(resolveError())}{' '}
          <button
            type="button"
            class={styles.link}
            onClick={() => resolveSelected()}
          >
            {props.labels.retry}
          </button>
        </div>
      </Show>

      <Show when={props.multiple} fallback={singleSelection()}>
        <Show
          when={selected().length > 0}
          fallback={
            <div class={styles.hint}>
              {props.emptyHint || props.labels.noSelection}
            </div>
          }
        >
          <ul
            class={styles.strip}
            classList={{ [styles.busy]: resolving() }}
            aria-labelledby={`${props.id}-label`}
          >
            <For each={selected()}>{(value, i) => selectionTile(value, i)}</For>
          </ul>
        </Show>
      </Show>

      <Show when={open()}>
        <Modal
          ref={(ref) => (modalRef = ref)}
          title={props.label}
          description={props.labels.dialogDescription}
          onClose={() => {
            setOpen(false);
            modalRef = undefined;
          }}
          contentClass={styles.dialog}
        >
          <div class={styles.dialogBody}>
            <Show when={props.search}>
              <input
                class={styles.search}
                type="search"
                value={query()}
                placeholder={props.labels.search}
                aria-label={props.labels.search}
                onInput={(e) => onSearch(e.currentTarget.value)}
              />
            </Show>

            <Show when={props.multiple}>
              <div class={styles.toolbar}>
                <span aria-live="polite">
                  {props.labels.selected(draft().length, props.max)}
                </span>
                <span class={styles.actions}>
                  <button type="button" class={styles.link} onClick={selectAll}>
                    {props.labels.selectAll}
                  </button>
                  <button
                    type="button"
                    class={styles.link}
                    onClick={() => setDraft([])}
                  >
                    {props.labels.selectNone}
                  </button>
                </span>
              </div>
            </Show>

            <div
              ref={resultsRef}
              class={styles.results}
              classList={{
                [styles.grid]: display() === 'grid',
                [styles.cards]: display() === 'cards',
              }}
              role="listbox"
              aria-multiselectable={props.multiple ? 'true' : undefined}
              aria-label={props.label}
              onKeyDown={onResultsKeyDown}
            >
              <For each={items()}>
                {(choice) => {
                  const isSelected = () =>
                    props.multiple
                      ? draft().includes(choice.value)
                      : selected()[0] === choice.value;
                  return (
                    <div
                      role="option"
                      tabindex="0"
                      aria-selected={isSelected()}
                      aria-disabled={
                        choice.disabled ||
                        (props.multiple && !isSelected() && atMax())
                      }
                      class={styles.option}
                      classList={{ [styles.selected]: isSelected() }}
                      onClick={() => toggle(choice)}
                      onKeyDown={(e) => {
                        if (
                          e.target === e.currentTarget &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          toggle(choice);
                        }
                      }}
                    >
                      <Show when={props.multiple}>
                        <span class={styles.check} aria-hidden="true">
                          {props.ordered && isSelected()
                            ? position(choice.value)
                            : isSelected()
                              ? '✓'
                              : ''}
                        </span>
                      </Show>
                      <Show when={display() !== 'list'}>
                        <ChoiceVisual
                          choice={choice}
                          labels={visualLabels()}
                          onEnlarge={setEnlarged}
                          interactive
                        />
                      </Show>
                      <span class={styles.text}>
                        <span class={styles.label}>{choice.label}</span>
                        <Show when={choice.description && display() !== 'grid'}>
                          <span class={styles.description}>
                            {choice.description}
                          </span>
                        </Show>
                      </span>
                    </div>
                  );
                }}
              </For>

              <Show when={loading()}>
                <For each={[1, 2, 3]}>
                  {() => (
                    <div
                      class={styles.optionSkeleton}
                      aria-hidden="true"
                      data-testid="choice-skeleton"
                    />
                  )}
                </For>
              </Show>
            </div>

            <Show when={!loading() && !error() && items().length === 0}>
              <div class={styles.hint}>{props.labels.noResults}</div>
            </Show>

            <Show when={error()}>
              <div class={styles.error} role="alert">
                {props.errorMessage(error())}{' '}
                <button
                  type="button"
                  class={styles.link}
                  onClick={() => loadPage(items().length === 0)}
                >
                  {props.labels.retry}
                </button>
              </div>
            </Show>

            <Show when={next() && !loading() && !error()}>
              <Button
                label={props.labels.loadMore}
                color="secondary"
                onClick={() => loadPage(false)}
              />
            </Show>

            <Show when={props.multiple}>
              <div class={styles.footer}>
                <Button
                  label={props.labels.cancel}
                  color="secondary"
                  onClick={closeDialog}
                />
                <Button
                  label={props.labels.done}
                  color="primary"
                  disabled={belowMin()}
                  onClick={applyDraft}
                />
              </div>
            </Show>

            <Show when={enlarged()}>
              <div
                class={styles.enlarged}
                role="dialog"
                aria-label={enlarged()!.label}
                onClick={() => setEnlarged(null)}
              >
                <img src={enlarged()!.preview!.url} alt={enlarged()!.label} />
                <button
                  type="button"
                  class={styles.closeEnlarged}
                  aria-label={props.labels.close}
                  ref={(el) => setTimeout(() => el.focus())}
                  onClick={() => setEnlarged(null)}
                >
                  <BsXLg />
                </button>
              </div>
            </Show>
          </div>
        </Modal>
      </Show>
    </div>
  );
};
