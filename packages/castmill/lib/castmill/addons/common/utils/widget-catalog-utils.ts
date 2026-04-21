import { JsonWidget } from '@castmill/player';

export type TranslateFn = (key: string, params?: Record<string, any>) => string;

export const getWidgetCatalogKeys = (widget: JsonWidget): string[] => {
  const keys = new Set<string>();

  if (widget.slug) {
    keys.add(widget.slug);
  }

  const templateName = widget.template?.name;
  if (templateName) {
    keys.add(templateName);
  }

  return [...keys];
};

/**
 * Looks up a translated widget field from the widgetCatalog i18n section,
 * falling back to the provided fallback value when no catalog entry exists.
 */
const getTranslatedWidgetField = (
  widget: JsonWidget,
  field: 'name' | 'description',
  fallback: string | undefined,
  t?: TranslateFn
): string | undefined => {
  if (!t) return fallback;

  const catalogKeys = getWidgetCatalogKeys(widget);
  for (const catalogKey of catalogKeys) {
    const key = `widgetCatalog.${catalogKey}.${field}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return fallback;
};

/**
 * Returns the translated widget name, falling back to the widget's own name.
 */
export const getTranslatedWidgetName = (
  widget: JsonWidget,
  t?: TranslateFn
): string =>
  getTranslatedWidgetField(widget, 'name', widget.name, t) ?? widget.name;

/**
 * Returns the translated widget description, falling back to the widget's own description.
 */
export const getTranslatedWidgetDescription = (
  widget: JsonWidget,
  t?: TranslateFn
): string | undefined =>
  getTranslatedWidgetField(widget, 'description', widget.description, t);
