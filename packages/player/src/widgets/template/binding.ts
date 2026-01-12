import { Model } from './data/model';

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

/**
 * Type guard to check if a value is any type of binding.
 */
export const isAnyBinding = (value: any): boolean =>
  isBinding(value) ||
  isSwitchBinding(value) ||
  isConditionalBinding(value) ||
  isConcatBinding(value);

export const resolveKey = (
  key: string,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
) => {
  if (key.startsWith('$.')) {
    // Resolve context path removing the "$." prefix
    return Model.get(context, key.substring(2), globals);
  }
  return Model.get(config, key, globals);
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
