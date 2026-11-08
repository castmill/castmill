import { TemplateConfig, resolveKey, resolveOption } from './binding';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

/**
 * Checks a component's `filter`: an object of key paths and the values they
 * must equal.
 */
export function checkFilter(
  filter: Record<string, any> | undefined,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): boolean {
  if (!filter) {
    return true;
  }

  return Object.keys(filter).every(
    (key) => filter[key] === resolveKey(key, config, context, globals)[0]
  );
}

/**
 * Whether a value counts as present for `when`: anything except undefined,
 * null, blank text, false, 0, NaN and empty lists.
 */
export function isPresent(value: any): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'number') return value !== 0 && !isNaN(value);
  if (typeof value === 'string') return value.replace(/^\s+|\s+$/g, '') !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Whether a component renders: its `filter` matches and its `when` binding,
 * if any, resolves to a present value.
 */
export function isVisible(
  component: { filter?: Record<string, any>; when?: any },
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): boolean {
  return (
    checkFilter(component.filter, config, context, globals) &&
    (component.when === undefined ||
      isPresent(resolveOption(component.when, config, context, globals)))
  );
}
