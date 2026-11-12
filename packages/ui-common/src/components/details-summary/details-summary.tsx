/** @jsxImportSource solid-js */

import { For, JSX, Show, createSignal, onCleanup } from 'solid-js';
import { BsCheck2, BsClipboard } from 'solid-icons/bs';

import styles from './details-summary.module.scss';

export type DetailsSummaryTone =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral';

export interface DetailsSummaryPill {
  label: JSX.Element;
  tone?: DetailsSummaryTone;
  /** Leading status dot (e.g. online/offline). */
  dot?: boolean;
  title?: string;
}

export interface DetailsSummaryChip {
  label: string;
  title?: string;
}

export interface DetailsSummaryCopy {
  /** Text written to the clipboard and shown (truncated) in the button. */
  value: string;
  /** Accessible name and tooltip of the copy button. */
  label: string;
  /** Short visible prefix, e.g. "ID". */
  prefix?: string;
  /** Announced to screen readers after a successful copy. */
  copiedMessage: string;
  onError?: (error: unknown) => void;
}

export interface DetailsSummaryProps {
  /** Accessible name of the summary region. */
  label: string;
  pills?: DetailsSummaryPill[];
  /** Secondary text next to the pills, e.g. "Last seen 5 minutes ago". */
  note?: JSX.Element;
  chips?: Array<string | DetailsSummaryChip>;
  copy?: DetailsSummaryCopy;
  /** Render as a slim inline strip on phones and touch devices. */
  compact?: boolean;
  class?: string;
}

export const COPY_FEEDBACK_MS = 2000;

/**
 * Summary card shown at the top of details drawers: status pills, a note,
 * meta chips and an optional copy-to-clipboard ID button.
 */
export const DetailsSummary = (props: DetailsSummaryProps) => {
  const [copied, setCopied] = createSignal(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));

  const copy = async (details: DetailsSummaryCopy) => {
    try {
      await navigator.clipboard.writeText(details.value);
      setCopied(true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch (error) {
      details.onError?.(error);
    }
  };

  const chips = () =>
    (props.chips ?? []).map((chip) =>
      typeof chip === 'string' ? { label: chip } : chip
    );

  return (
    <section
      class={[styles.summary, props.compact ? styles.compact : '', props.class]
        .filter(Boolean)
        .join(' ')}
      aria-label={props.label}
      data-details-summary
    >
      <div class={styles.status}>
        <For each={props.pills}>
          {(pill) => (
            <span
              class={`${styles.pill} ${styles[pill.tone ?? 'info']}`}
              title={pill.title}
              data-tone={pill.tone ?? 'info'}
            >
              <Show when={pill.dot}>
                <span class={styles.dot} aria-hidden="true" />
              </Show>
              {pill.label}
            </span>
          )}
        </For>
        <Show when={props.note}>
          {(note) => <span class={styles.note}>{note()}</span>}
        </Show>
      </div>

      <Show when={chips().length > 0 || props.copy}>
        <div class={styles.meta}>
          <For each={chips()}>
            {(chip) => (
              <span class={styles.chip} title={chip.title}>
                {chip.label}
              </span>
            )}
          </For>
          <Show when={props.copy}>
            {(details) => (
              <>
                <button
                  type="button"
                  class={styles.copy}
                  onClick={() => copy(details())}
                  title={details().label}
                  aria-label={details().label}
                >
                  <Show when={details().prefix}>
                    <span class={styles.copyPrefix}>{details().prefix}</span>
                  </Show>
                  <code>{details().value}</code>
                  <Show
                    when={copied()}
                    fallback={<BsClipboard aria-hidden="true" />}
                  >
                    <BsCheck2 aria-hidden="true" />
                  </Show>
                </button>
                <span class={styles.visuallyHidden} aria-live="polite">
                  {copied() ? details().copiedMessage : ''}
                </span>
              </>
            )}
          </Show>
        </div>
      </Show>
    </section>
  );
};
