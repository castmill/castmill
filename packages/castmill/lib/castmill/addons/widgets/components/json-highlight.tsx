import { JSX } from 'solid-js';

/**
 * Simple JSON syntax highlighter for SolidJS
 * Returns a formatted JSX element with syntax highlighting
 */
export function JsonHighlight(props: { json: any }): JSX.Element {
  const jsonString = JSON.stringify(props.json, null, 2);
  
  // Simple regex-based syntax highlighting
  const highlighted = jsonString
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (match, p1, p2) => {
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

  return (
    <pre class="json-highlight">
      <code innerHTML={highlighted} />
    </pre>
  );
}
