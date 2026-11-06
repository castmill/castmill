import { Model } from './data/model';
import { now } from './format/clock';
import { parseDate } from './format/date';
import { evaluateFmt } from './format/fmt';

export interface Binding<T extends any> {
  key: string;
  default?: T;
}

/**
 * Switch binding - selects a value based on matching a key against cases.
 * Similar to a switch statement in programming languages.
 *
 * @example
 * ```json
 * {
 *   "switch": {
 *     "key": "$.direction",
 *     "cases": {
 *       "up": "#00C853",
 *       "down": "#FF1744",
 *       "default": "#9E9E9E"
 *     }
 *   }
 * }
 * ```
 */
export interface SwitchBinding<T = any> {
  switch: {
    /**
     * The key path to resolve and match against cases.
     */
    key: string;
    /**
     * Map of case values to results. Use "default" key for fallback.
     * Each value can be a literal or another binding.
     */
    cases: Record<string, T | Binding<T>>;
  };
}

/**
 * Conditional binding - selects a value based on numeric comparison.
 * Useful for threshold-based styling (e.g., color based on positive/negative values).
 *
 * @example
 * ```json
 * {
 *   "cond": {
 *     "key": "$.change",
 *     "gte": 0,
 *     "then": "#00C853",
 *     "else": "#FF1744"
 *   }
 * }
 * ```
 */
export interface ConditionalBinding<T = any> {
  cond: {
    /**
     * The key path to resolve and compare.
     */
    key: string;
    /**
     * Greater than or equal comparison (if provided).
     */
    gte?: number;
    /**
     * Greater than comparison (if provided).
     */
    gt?: number;
    /**
     * Less than or equal comparison (if provided).
     */
    lte?: number;
    /**
     * Less than comparison (if provided).
     */
    lt?: number;
    /**
     * Equals comparison (if provided).
     */
    eq?: any;
    /**
     * Not equals comparison (if provided).
     */
    neq?: any;
    /**
     * Value to return if condition is true.
     */
    then: T | Binding<T>;
    /**
     * Value to return if condition is false.
     */
    else: T | Binding<T>;
  };
}

/**
 * Concat binding - concatenates multiple values (resolved bindings or literals) into a string.
 * Useful for appending units to numeric values.
 *
 * @example
 * ```json
 * {
 *   "concat": [{"key": "options.ticker_height", "default": 5}, "vh"]
 * }
 * // With ticker_height = 8, resolves to "8vh"
 * ```
 */
export interface ConcatBinding {
  concat: Array<string | number | Binding<any>>;
}

/**
 * Format binding - a text with placeholders, each a path and formatters.
 * If any placeholder is empty, the whole text is empty.
 *
 * @example
 * ```json
 * { "fmt": "{data.price | number} kr" }
 * ```
 */
export interface FmtBinding {
  fmt: string;
}

export interface ListCondition {
  key: string;
  eq?: any;
  neq?: any;
  gt?: any;
  gte?: any;
  lt?: any;
  lte?: any;
  present?: boolean;
}

/**
 * List binding - builds a list from an array: where → sort → item → drop
 * empty results → limit → join.
 *
 * @example
 * ```json
 * { "list": { "key": "data.viewings", "where": [{ "key": "$.end", "gte": "@now" }],
 *             "limit": 2, "item": { "fmt": "{$.start | date:'D/M'}" }, "join": ", " } }
 * ```
 */
export interface ListBinding {
  list: {
    key?: string;
    items?: any[];
    where?: ListCondition[];
    sort?: string;
    desc?: boolean;
    item?: any;
    limit?: number;
    join?: string;
  };
}

/**
 * First binding - the first value that is not empty (fallbacks, overrides).
 *
 * @example
 * ```json
 * { "first": [{ "key": "options.price_text" }, { "fmt": "{data.price | number} kr" }] }
 * ```
 */
export interface FirstBinding {
  first: any[];
}

export interface TemplateConfig<Options = any, Data = any> {
  options: Options;
  data: Data;
}

/**
 * Type guard to check if a value is a simple key binding.
 */
export const isBinding = (value: any): value is Binding<any> =>
  typeof value === 'object' &&
  value !== null &&
  'key' in value &&
  !('switch' in value) &&
  !('cond' in value);

/**
 * Type guard to check if a value is a switch binding.
 */
export const isSwitchBinding = (value: any): value is SwitchBinding =>
  typeof value === 'object' && value !== null && 'switch' in value;

/**
 * Type guard to check if a value is a conditional binding.
 */
export const isConditionalBinding = (value: any): value is ConditionalBinding =>
  typeof value === 'object' && value !== null && 'cond' in value;

/**
 * Type guard to check if a value is a concat binding.
 */
export const isConcatBinding = (value: any): value is ConcatBinding =>
  typeof value === 'object' &&
  value !== null &&
  'concat' in value &&
  Array.isArray(value.concat);

export const isFmtBinding = (value: any): value is FmtBinding =>
  typeof value === 'object' && value !== null && typeof value.fmt === 'string';

export const isListBinding = (value: any): value is ListBinding =>
  typeof value === 'object' &&
  value !== null &&
  typeof value.list === 'object' &&
  value.list !== null &&
  !Array.isArray(value.list);

export const isFirstBinding = (value: any): value is FirstBinding =>
  typeof value === 'object' && value !== null && Array.isArray(value.first);

/**
 * Type guard to check if a value is any type of binding.
 */
export const isAnyBinding = (value: any): boolean =>
  isBinding(value) ||
  isSwitchBinding(value) ||
  isConditionalBinding(value) ||
  isConcatBinding(value) ||
  isFmtBinding(value) ||
  isListBinding(value) ||
  isFirstBinding(value);

/**
 * Resolves a key path. "$.path" (or "$") reads the current context, such as a
 * list item; "@name" reads a player global ("@now" is the current time in
 * milliseconds, re-evaluated every minute); anything else reads the template
 * config (`options.…`, `data.…`).
 */
export const resolveKey = (
  key: string,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): [any, Error | undefined] => {
  if (key === '$') {
    return [
      context,
      context === undefined ? new Error('No context') : undefined,
    ];
  }
  if (key.slice(0, 2) === '$.') {
    // Resolve context path removing the "$." prefix
    return Model.get(context, key.substring(2), globals) as [
      any,
      Error | undefined,
    ];
  }
  if (key.charAt(0) === '@') {
    const name = key.slice(1);
    if (name === 'now') {
      return [now(), undefined];
    }
    const value = globals ? globals[name] : undefined;
    return [
      value,
      value === undefined ? new Error(`Unknown global ${key}`) : undefined,
    ];
  }
  return Model.get(config, key, globals) as [any, Error | undefined];
};

export const resolveBinding = (
  binding: Binding<any>,
  config: TemplateConfig,
  currentContext: any,
  globals: { [index: string]: any }
) => {
  const result = resolveKey(binding.key, config, currentContext, globals);

  if (typeof result == 'undefined' || result[1] != null) {
    return binding.default;
  }
  return result[0];
};

/**
 * Resolves a switch binding by matching the key value against cases.
 */
export const resolveSwitchBinding = (
  binding: SwitchBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any => {
  const { key, cases } = binding.switch;

  // Resolve the key to get the value to match
  const [value, error] = resolveKey(key, config, context, globals);

  if (error || value === undefined || value === null) {
    // If we can't resolve the key, use default case
    const defaultCase = cases['default'];
    return defaultCase !== undefined
      ? resolveOption(defaultCase, config, context, globals)
      : undefined;
  }

  // Convert value to string for case matching
  const matchKey = String(value);

  // Look for exact match first
  if (matchKey in cases) {
    return resolveOption(cases[matchKey], config, context, globals);
  }

  // Fall back to default case
  const defaultCase = cases['default'];
  return defaultCase !== undefined
    ? resolveOption(defaultCase, config, context, globals)
    : undefined;
};

/**
 * Resolves a conditional binding by evaluating the condition.
 */
export const resolveConditionalBinding = (
  binding: ConditionalBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any => {
  const { key, gte, gt, lte, lt, eq, neq } = binding.cond;
  const thenValue = binding.cond.then;
  const elseValue = binding.cond.else;

  // Resolve the key to get the value to compare
  const [value, error] = resolveKey(key, config, context, globals);

  if (error || value === undefined || value === null) {
    // If we can't resolve the key, return else value
    return resolveOption(elseValue, config, context, globals);
  }

  // Evaluate conditions
  let conditionMet = false;

  if (gte !== undefined && typeof value === 'number') {
    conditionMet = value >= gte;
  } else if (gt !== undefined && typeof value === 'number') {
    conditionMet = value > gt;
  } else if (lte !== undefined && typeof value === 'number') {
    conditionMet = value <= lte;
  } else if (lt !== undefined && typeof value === 'number') {
    conditionMet = value < lt;
  } else if (eq !== undefined) {
    conditionMet = value === eq;
  } else if (neq !== undefined) {
    conditionMet = value !== neq;
  }

  return conditionMet
    ? resolveOption(thenValue, config, context, globals)
    : resolveOption(elseValue, config, context, globals);
};

/**
 * Resolves a concat binding by concatenating all resolved values into a string.
 * Useful for appending units to numeric values (e.g., "5" + "vh" = "5vh").
 */
export const resolveConcatBinding = (
  binding: ConcatBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): string => {
  return binding.concat
    .map((part) => {
      const resolved = resolveOption(part, config, context, globals);
      return resolved !== undefined && resolved !== null
        ? String(resolved)
        : '';
    })
    .join('');
};

/**
 * Resolves any option value, handling simple values, bindings, switch bindings,
 * conditional bindings, and concat bindings.
 */
export const resolveOption = (
  option: any,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any => {
  if (isFmtBinding(option)) {
    return resolveFmtBinding(option, config, context, globals);
  }
  if (isListBinding(option)) {
    return resolveListBinding(option, config, context, globals);
  }
  if (isFirstBinding(option)) {
    return resolveFirstBinding(option, config, context, globals);
  }
  if (isSwitchBinding(option)) {
    return resolveSwitchBinding(option, config, context, globals);
  }
  if (isConditionalBinding(option)) {
    return resolveConditionalBinding(option, config, context, globals);
  }
  if (isConcatBinding(option)) {
    return resolveConcatBinding(option, config, context, globals);
  }
  if (isBinding(option)) {
    return resolveBinding(option, config, context, globals);
  }
  return option;
};

const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * The locale used by formatters: the template's `locale` option, else the
 * player's `locale` global (the organization's display locale).
 */
const formatLocale = (
  config: TemplateConfig,
  globals: { [index: string]: any }
): string | undefined =>
  (config && config.options && config.options.locale) ||
  (globals && globals.locale);

export const resolveFmtBinding = (
  binding: FmtBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): string =>
  evaluateFmt(
    binding.fmt,
    (path) => {
      const [value, error] = resolveKey(path, config, context, globals);
      return error ? undefined : value;
    },
    { locale: formatLocale(config, globals) }
  );

export const resolveFirstBinding = (
  binding: FirstBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any => {
  for (let i = 0; i < binding.first.length; i++) {
    const value = resolveOption(binding.first[i], config, context, globals);
    if (!isEmptyValue(value)) {
      return value;
    }
  }
  return undefined;
};

// Resolves bindings nested anywhere inside a literal value (list `items`).
const resolveDeep = (
  value: any,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any => {
  if (isAnyBinding(value)) {
    return resolveOption(value, config, context, globals);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, config, context, globals));
  }
  if (typeof value === 'object' && value !== null) {
    const result: { [key: string]: any } = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = resolveDeep(value[key], config, context, globals);
      }
    }
    return result;
  }
  return value;
};

const NOW = '@now';

// Dates and "@now" compare as instants, numbers as numbers.
const comparable = (value: any, other: any): number | undefined => {
  if (value === NOW) {
    return now();
  }
  if (other === NOW) {
    const date = parseDate(value);
    return date ? date.getTime() : undefined;
  }
  return typeof value === 'number' ? value : undefined;
};

const ORDERING: { [op: string]: (a: number, b: number) => boolean } = {
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

const matches = (
  condition: ListCondition,
  element: any,
  config: TemplateConfig,
  globals: { [index: string]: any }
): boolean => {
  const [resolved, error] = resolveKey(condition.key, config, element, globals);
  const value = error ? undefined : resolved;

  if (condition.present !== undefined) {
    return isEmptyValue(value) !== !!condition.present;
  }

  for (const op in ORDERING) {
    if (Object.prototype.hasOwnProperty.call(condition, op)) {
      const expected = (condition as any)[op];
      const a = comparable(value, expected);
      const b = comparable(expected, value);
      return a !== undefined && b !== undefined && ORDERING[op](a, b);
    }
  }

  for (const op of ['eq', 'neq']) {
    if (Object.prototype.hasOwnProperty.call(condition, op)) {
      const expected = (condition as any)[op];
      const equal =
        expected === NOW
          ? comparable(value, NOW) === comparable(NOW, value)
          : value === expected;
      return op === 'eq' ? equal : !equal;
    }
  }

  return true;
};

const sortKey = (value: any): number | string => {
  if (typeof value === 'number') {
    return value;
  }
  const date = parseDate(value);
  if (date) {
    return date.getTime();
  }
  return value === undefined || value === null ? '' : String(value);
};

export const resolveListBinding = (
  binding: ListBinding,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
): any[] | string => {
  const spec = binding.list;

  let source: any;
  if (Array.isArray(spec.items)) {
    source = resolveDeep(spec.items, config, context, globals);
  } else if (typeof spec.key === 'string') {
    const [value, error] = resolveKey(spec.key, config, context, globals);
    source = error ? undefined : value;
  }
  let elements: any[] = Array.isArray(source) ? source.slice() : [];

  if (Array.isArray(spec.where)) {
    elements = elements.filter((element) =>
      spec.where!.every((condition) =>
        matches(condition, element, config, globals)
      )
    );
  }

  if (typeof spec.sort === 'string') {
    const direction = spec.desc ? -1 : 1;
    // Decorate with the index for a stable sort (Chrome 38's sort is not).
    elements = elements
      .map((element, index) => {
        const [value] = resolveKey(spec.sort!, config, element, globals);
        return { element, index, key: sortKey(value) };
      })
      .sort((a, b) => {
        if (a.key < b.key) return -direction;
        if (a.key > b.key) return direction;
        return a.index - b.index;
      })
      .map((entry) => entry.element);
  }

  let results =
    spec.item === undefined
      ? elements
      : elements.map((element) =>
          resolveOption(spec.item, config, element, globals)
        );
  results = results.filter((value) => !isEmptyValue(value));

  if (typeof spec.limit === 'number' && spec.limit >= 0) {
    results = results.slice(0, spec.limit);
  }

  return typeof spec.join === 'string'
    ? results.map((value) => String(value)).join(spec.join)
    : results;
};
