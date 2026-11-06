import { FORMATTERS, FormatterContext } from './formatters';

export interface FmtFormatterCall {
  name: string;
  args: string[];
}

export type FmtSegment =
  | { literal: string }
  | { path: string; formatters: FmtFormatterCall[] };

export class FmtSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FmtSyntaxError';
  }
}

/**
 * Parses a `fmt` text:
 *
 *   fmt         := ( literal | placeholder )*
 *   placeholder := "{" path ( "|" formatter )* "}"
 *   formatter   := name ( ":" arg )*
 *   arg         := "'" text "'" | number | word
 *
 * "{{" and "}}" are literal braces. Inside quotes, "''" is a literal quote.
 */
export function parseFmt(source: string): FmtSegment[] {
  const segments: FmtSegment[] = [];
  let literal = '';
  let i = 0;

  while (i < source.length) {
    const char = source.charAt(i);
    if (char === '{' && source.charAt(i + 1) === '{') {
      literal += '{';
      i += 2;
    } else if (char === '}' && source.charAt(i + 1) === '}') {
      literal += '}';
      i += 2;
    } else if (char === '}') {
      throw new FmtSyntaxError(`Unexpected "}" at position ${i}`);
    } else if (char === '{') {
      if (literal) {
        segments.push({ literal });
        literal = '';
      }
      const [placeholder, end] = parsePlaceholder(source, i + 1);
      segments.push(placeholder);
      i = end + 1;
    } else {
      literal += char;
      i++;
    }
  }

  if (literal) {
    segments.push({ literal });
  }
  return segments;
}

// Splits the placeholder starting at `start` into "|"-separated parts, and each
// formatter into ":"-separated arguments, honoring quotes. Returns the segment
// and the position of the closing "}".
function parsePlaceholder(source: string, start: number): [FmtSegment, number] {
  const parts: string[][] = [[]];
  let current = '';
  let quoted: string | undefined;

  const finishItem = () => {
    parts[parts.length - 1].push(
      quoted !== undefined ? quoted : current.trim()
    );
    current = '';
    quoted = undefined;
  };

  for (let i = start; i < source.length; i++) {
    const char = source.charAt(i);

    if (char === "'") {
      if (quoted !== undefined || current.trim() !== '') {
        throw new FmtSyntaxError(`Unexpected quote at position ${i}`);
      }
      let value = '';
      for (i++; ; i++) {
        if (i >= source.length) {
          throw new FmtSyntaxError(`Unclosed quote at position ${start - 1}`);
        }
        const next = source.charAt(i);
        if (next === "'" && source.charAt(i + 1) === "'") {
          value += "'";
          i++;
        } else if (next === "'") {
          break;
        } else {
          value += next;
        }
      }
      quoted = value;
      current = '';
    } else if (char === ':' || char === '|' || char === '}') {
      finishItem();
      if (char === '|') {
        parts.push([]);
      } else if (char === '}') {
        return [placeholderFrom(parts, start), i];
      }
    } else if (char === '{') {
      throw new FmtSyntaxError(`Unexpected "{" at position ${i}`);
    } else if (quoted !== undefined && char !== ' ') {
      throw new FmtSyntaxError(`Unexpected text after quote at position ${i}`);
    } else {
      current += char;
    }
  }

  throw new FmtSyntaxError(`Unclosed placeholder at position ${start - 1}`);
}

function placeholderFrom(parts: string[][], start: number): FmtSegment {
  const [pathPart, ...formatterParts] = parts;
  if (pathPart.length !== 1 || pathPart[0] === '') {
    throw new FmtSyntaxError(`Missing path at position ${start}`);
  }

  const formatters = formatterParts.map((part) => {
    const [name, ...args] = part;
    if (!name) {
      throw new FmtSyntaxError(`Missing formatter name at position ${start}`);
    }
    const formatter = FORMATTERS[name];
    if (!formatter || !Object.prototype.hasOwnProperty.call(FORMATTERS, name)) {
      throw new FmtSyntaxError(`Unknown formatter "${name}"`);
    }
    const [min, max] = formatter.args;
    if (args.length < min || args.length > max) {
      throw new FmtSyntaxError(
        `Formatter "${name}" takes ${min === max ? min : `${min} to ${max}`} argument(s)`
      );
    }
    return { name, args };
  });

  return { path: pathPart[0], formatters };
}

const cache: { [source: string]: FmtSegment[] | FmtSyntaxError } = {};

function cachedParse(source: string): FmtSegment[] | FmtSyntaxError {
  if (!Object.prototype.hasOwnProperty.call(cache, source)) {
    try {
      cache[source] = parseFmt(source);
    } catch (error) {
      cache[source] =
        error instanceof FmtSyntaxError
          ? error
          : new FmtSyntaxError(String(error));
    }
  }
  return cache[source];
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '';

/**
 * Evaluates a `fmt` text. If any placeholder is empty after its formatters,
 * the whole text is empty (""), so units next to a missing value disappear.
 */
export function evaluateFmt(
  source: string,
  resolvePath: (path: string) => unknown,
  context: FormatterContext
): string {
  const segments = cachedParse(source);
  if (segments instanceof FmtSyntaxError) {
    console.warn(`Invalid fmt "${source}": ${segments.message}`);
    return '';
  }

  let result = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if ('literal' in segment) {
      result += segment.literal;
      continue;
    }
    let value = resolvePath(segment.path);
    for (let j = 0; j < segment.formatters.length; j++) {
      const call = segment.formatters[j];
      value = FORMATTERS[call.name].apply(value, call.args, context);
    }
    if (isEmpty(value)) {
      return '';
    }
    result += String(value);
  }
  return result;
}
