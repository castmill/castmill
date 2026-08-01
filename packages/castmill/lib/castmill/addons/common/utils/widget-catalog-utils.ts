import { JsonWidget } from '@castmill/player';

/**
 * Looks up a translated widget field from the widget's own translations,
 * falling back to the English translation, then to the provided fallback value.
 */
const getTranslatedWidgetField = (
  widget: JsonWidget,
  field: 'name' | 'description',
  fallback: string | undefined,
  locale?: string
): string | undefined => {
  if (!locale || !widget.translations) return fallback;

  return (
    widget.translations[locale]?.[field] ??
    widget.translations['en']?.[field] ??
    fallback
  );
};

/**
 * Returns the translated widget name, falling back to the widget's own name.
 */
export const getTranslatedWidgetName = (
  widget: JsonWidget,
  locale?: string
): string =>
  getTranslatedWidgetField(widget, 'name', widget.name, locale) ?? widget.name;

/**
 * Returns the translated widget description, falling back to the widget's own description.
 */
export const getTranslatedWidgetDescription = (
  widget: JsonWidget,
  locale?: string
): string | undefined =>
  getTranslatedWidgetField(widget, 'description', widget.description, locale);

/**
 * Returns a translated widget option field (label, description, or placeholder),
 * falling back to the English translation, then to the provided fallback value.
 */
export const getTranslatedWidgetOption = (
  widget: JsonWidget,
  optionKey: string,
  optionField: 'label' | 'description' | 'placeholder',
  fallback: string | undefined,
  locale?: string
): string | undefined => {
  if (!locale || !widget.translations) return fallback;

  return (
    widget.translations[locale]?.options?.[optionKey]?.[optionField] ??
    widget.translations['en']?.options?.[optionKey]?.[optionField] ??
    fallback
  );
};
