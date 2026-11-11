const NUMERIC = /^-?\d+(?:\.\d+)?$/;

/**
 * Groups the digits of a number using the given separators.
 *
 * `decimals` is a number of decimals (rounded) or "auto" to keep the value's
 * own decimals. Strings that are not plain numbers (e.g. "3-4") are returned
 * unchanged; empty values return undefined.
 */
export function formatNumber(
  value: unknown,
  decimals: number | 'auto',
  group: string,
  decimal: string
): string | undefined {
  let text: string;

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return undefined;
    }
    text = decimals === 'auto' ? plain(value) : value.toFixed(decimals);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }
    if (!NUMERIC.test(trimmed)) {
      return value;
    }
    text = decimals === 'auto' ? trimmed : (+trimmed).toFixed(decimals);
  } else {
    return undefined;
  }

  const negative = text.charAt(0) === '-';
  if (negative) {
    text = text.slice(1);
  }

  const parts = text.split('.');
  const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const result = parts.length > 1 ? integer + decimal + parts[1] : integer;

  return (negative && /[1-9]/.test(text) ? '-' : '') + result;
}

// Avoids exponent notation for small decimals (1e-7).
function plain(value: number): string {
  const text = String(value);
  return text.indexOf('e-') === -1
    ? text
    : value.toFixed(20).replace(/\.?0+$/, '');
}
