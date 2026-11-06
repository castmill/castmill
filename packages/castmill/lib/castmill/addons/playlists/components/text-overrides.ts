import { JsonWidget } from '@castmill/player';

/**
 * Helpers for the editable texts of template widgets (in-place editing).
 * See agents/systems/IN-PLACE-TEXT-EDITING.md.
 */

export type TextOverride = { text: string } | { hidden: true };
export type TextOverrides = Record<string, TextOverride>;

export const DEFAULT_MAX_LENGTH = 500;

export interface StaticEditable {
  key: string;
  label?: string;
  multiline: boolean;
  maxLength: number;
}

export interface TemplateEditables {
  /** Editable texts whose key is a plain string. */
  static: StaticEditable[];
  /** True when some keys come from bindings (e.g. texts inside lists). */
  dynamic: boolean;
}

/** An editable text as rendered in the preview. */
export interface EditableElementInfo {
  key: string;
  label?: string;
  multiline: boolean;
  maxLength: number;
  overridden?: 'text' | 'hidden';
  /** The text as currently shown. */
  text: string;
}

const maxLengthOf = (value: unknown) =>
  typeof value === 'number' && value > 0 ? value : DEFAULT_MAX_LENGTH;

/** Lists the editable texts declared by a widget template. */
export const templateEditables = (template: unknown): TemplateEditables => {
  const result: TemplateEditables = { static: [], dynamic: false };
  const seen = new Set<any>();

  const walk = (node: any) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const editable = node.editable;
    if (node.type === 'text' && editable && typeof editable === 'object') {
      if (typeof editable.key === 'string' && editable.key.trim() !== '') {
        result.static.push({
          key: editable.key,
          label:
            typeof editable.label === 'string' ? editable.label : undefined,
          multiline: editable.multiline === true,
          maxLength: maxLengthOf(editable.max_length),
        });
      } else if (editable.key && typeof editable.key === 'object') {
        result.dynamic = true;
      }
    }
    Object.keys(node).forEach((key) => {
      if (key !== 'editable') walk(node[key]);
    });
  };

  walk(template);
  return result;
};

/**
 * True when the widget reserves the `overrides` option: its template has
 * editable texts and its options_schema does not declare `overrides` itself.
 */
export const supportsTextOverrides = (widget: JsonWidget): boolean => {
  const schema = widget.options_schema as Record<string, unknown> | undefined;
  if (schema && !Array.isArray(schema) && 'overrides' in schema) {
    return false;
  }
  const editables = templateEditables(widget.template);
  return editables.static.length > 0 || editables.dynamic;
};

const isOverride = (value: unknown): value is TextOverride =>
  !!value &&
  typeof value === 'object' &&
  ((value as any).hidden === true || typeof (value as any).text === 'string');

/** The valid overrides stored in widget options. */
export const getOverrides = (options: unknown): TextOverrides => {
  const overrides =
    options && typeof options === 'object'
      ? (options as Record<string, unknown>).overrides
      : undefined;
  const result: TextOverrides = {};
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    for (const [key, value] of Object.entries(overrides)) {
      if (isOverride(value)) result[key] = value;
    }
  }
  return result;
};

export const countOverrides = (options: unknown): number =>
  Object.keys(getOverrides(options)).length;

/** Returns new overrides with `key` set, or removed when `value` is undefined. */
export const setOverride = (
  overrides: TextOverrides,
  key: string,
  value: TextOverride | undefined
): TextOverrides => {
  const next = { ...overrides };
  if (value) {
    next[key] = value;
  } else {
    delete next[key];
  }
  return next;
};

/** Translates an editable text label through the widget's translations. */
export const translateEditableLabel = (
  widget: JsonWidget,
  label: string | undefined,
  locale?: string
): string | undefined => {
  if (!label) return label;
  const translations = (widget as any).translations as
    | Record<string, { editable?: Record<string, string> }>
    | undefined;
  return (
    (locale && translations?.[locale]?.editable?.[label]) ??
    translations?.en?.editable?.[label] ??
    label
  );
};

/** Reads the editor hooks the player renders on an editable text. */
export const readEditableElement = (
  element: Element
): EditableElementInfo | undefined => {
  const key = element.getAttribute('data-editable-key');
  if (!key) return undefined;
  const overridden = element.getAttribute('data-editable-overridden');
  return {
    key,
    label: element.getAttribute('data-editable-label') || undefined,
    multiline: element.getAttribute('data-editable-multiline') === 'true',
    maxLength: maxLengthOf(
      Number(element.getAttribute('data-editable-max-length'))
    ),
    overridden:
      overridden === 'text' || overridden === 'hidden' ? overridden : undefined,
    // Split-character animations render non-breaking spaces between words.
    text: (element.textContent || '').replace(/\u00a0/g, ' '),
  };
};

export interface OverrideEntry {
  key: string;
  label: string;
  override: TextOverride;
}

/**
 * Splits overrides into the ones that match an editable text and the unused ones.
 * Keys from bindings (texts inside lists) are only known once rendered, so when
 * the template has such texts, keys not seen yet are not reported as unused.
 */
export const describeOverrides = (
  overrides: TextOverrides,
  editables: TemplateEditables,
  seenLabels: Map<string, string | undefined>,
  translate: (label: string | undefined) => string | undefined
): { used: OverrideEntry[]; unused: OverrideEntry[] } => {
  const staticLabels = new Map(
    editables.static.map((editable) => [editable.key, editable.label])
  );
  const used: OverrideEntry[] = [];
  const unused: OverrideEntry[] = [];

  for (const [key, override] of Object.entries(overrides)) {
    const known = staticLabels.has(key) || seenLabels.has(key);
    const label =
      translate(staticLabels.get(key) ?? seenLabels.get(key)) || key;
    const entry = { key, label, override };
    if (known || editables.dynamic) {
      used.push(entry);
    } else {
      unused.push(entry);
    }
  }

  const byLabel = (a: OverrideEntry, b: OverrideEntry) =>
    a.label.localeCompare(b.label);
  return { used: used.sort(byLabel), unused: unused.sort(byLabel) };
};
