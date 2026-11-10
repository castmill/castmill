import { Component, For, Show } from 'solid-js';
import { BsArrowCounterclockwise, BsXLg } from 'solid-icons/bs';

import { OverrideEntry } from './text-overrides';
import styles from './text-overrides-list.module.scss';

export interface TextOverridesListLabels {
  title: (count: number) => string;
  hidden: string;
  empty: string;
  reset: string;
  resetAll: string;
  unusedTitle: string;
  unusedHint: string;
  remove: string;
}

interface TextOverridesListProps {
  used: OverrideEntry[];
  unused: OverrideEntry[];
  labels: TextOverridesListLabels;
  onReset: (key: string) => void;
  onResetAll: () => void;
}

const overrideText = (entry: OverrideEntry, labels: TextOverridesListLabels) =>
  'hidden' in entry.override
    ? labels.hidden
    : entry.override.text || labels.empty;

/** Lists the edited texts of a playlist item, with reset actions. */
export const TextOverridesList: Component<TextOverridesListProps> = (props) => {
  const total = () => props.used.length + props.unused.length;

  const row = (entry: OverrideEntry, unused: boolean) => (
    <li class={styles.row} data-testid="text-override">
      <span class={styles.text}>
        <span class={styles.label}>{entry.label}</span>
        <span
          class={styles.value}
          classList={{ [styles.hidden]: 'hidden' in entry.override }}
        >
          {overrideText(entry, props.labels)}
        </span>
      </span>
      <button
        type="button"
        class={styles.action}
        aria-label={`${unused ? props.labels.remove : props.labels.reset}: ${entry.label}`}
        title={unused ? props.labels.remove : props.labels.reset}
        onClick={() => props.onReset(entry.key)}
      >
        {unused ? <BsXLg /> : <BsArrowCounterclockwise />}
      </button>
    </li>
  );

  return (
    <Show when={total() > 0}>
      <section class={styles.list} aria-label={props.labels.title(total())}>
        <div class={styles.header}>
          <span>{props.labels.title(total())}</span>
          <button
            type="button"
            class={styles.link}
            onClick={() => props.onResetAll()}
          >
            {props.labels.resetAll}
          </button>
        </div>
        <ul>
          <For each={props.used}>{(entry) => row(entry, false)}</For>
        </ul>
        <Show when={props.unused.length > 0}>
          <div class={styles.unused}>
            <span class={styles.subtitle}>{props.labels.unusedTitle}</span>
            <span class={styles.hint}>{props.labels.unusedHint}</span>
            <ul>
              <For each={props.unused}>{(entry) => row(entry, true)}</For>
            </ul>
          </div>
        </Show>
      </section>
    </Show>
  );
};
