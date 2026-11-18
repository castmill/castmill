import { JSX, Show, createSignal, onCleanup } from 'solid-js';
import { BsCheck2, BsClipboard } from 'solid-icons/bs';

export const JSON_COPY_FEEDBACK_MS = 2000;

export interface JsonHighlightProps {
  json: any;
  /** Accessible name of the copy button. The button is hidden when omitted. */
  copyLabel?: string;
  /** Announced to screen readers after a successful copy. */
  copiedMessage?: string;
  onCopyError?: (error: unknown) => void;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Simple JSON syntax highlighter for SolidJS.
 * Colours come from the `--cm-*` theme tokens, long lines scroll
 * horizontally and an optional button copies the JSON to the clipboard.
 */
export function JsonHighlight(props: JsonHighlightProps): JSX.Element {
  const jsonString = () => JSON.stringify(props.json, null, 2) ?? 'null';

  // Simple regex-based syntax highlighting. The JSON is escaped first so
  // widget-provided strings can never inject markup.
  const highlighted = () =>
    escapeHtml(jsonString())
      .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (_match, p1, p2) => {
        // Property keys (before colon)
        if (p2) {
          return `<span class="json-key">${p1}</span>${p2}`;
        }
        // String values
        return `<span class="json-string">${p1}</span>`;
      })
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');

  const [copied, setCopied] = createSignal(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString());
      setCopied(true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), JSON_COPY_FEEDBACK_MS);
    } catch (error) {
      props.onCopyError?.(error);
    }
  };

  return (
    <div class="json-viewer">
      <Show when={props.copyLabel}>
        {(label) => (
          <div class="json-viewer-toolbar">
            <button
              type="button"
              class="json-copy"
              onClick={copy}
              title={label()}
              aria-label={label()}
            >
              <Show
                when={copied()}
                fallback={<BsClipboard aria-hidden="true" />}
              >
                <BsCheck2 aria-hidden="true" />
              </Show>
            </button>
            <span class="json-viewer-status" aria-live="polite">
              {copied() ? props.copiedMessage : ''}
            </span>
          </div>
        )}
      </Show>
      <pre class="json-highlight" tabIndex={0}>
        <code innerHTML={highlighted()} />
      </pre>
    </div>
  );
}
