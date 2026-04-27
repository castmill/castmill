import { describe, it, expect } from 'vitest';
import type { JsonWidget } from '@castmill/player';
import {
  getTranslatedWidgetName,
  getTranslatedWidgetDescription,
  getTranslatedWidgetOption,
} from './widget-catalog-utils';

const createWidget = (overrides: Partial<JsonWidget> = {}): JsonWidget =>
  ({
    slug: 'sample-widget',
    name: 'Default Name',
    description: 'Default Description',
    options: {},
    ...overrides,
  }) as JsonWidget;

describe('widget-catalog-utils', () => {
  describe('getTranslatedWidgetName', () => {
    it('returns locale-specific widget name when available', () => {
      const widget = createWidget({
        translations: {
          sv: { name: 'Svenskt Namn' },
          en: { name: 'English Name' },
        },
      });

      expect(getTranslatedWidgetName(widget, 'sv')).toBe('Svenskt Namn');
    });

    it('falls back to English name when locale translation is missing', () => {
      const widget = createWidget({
        translations: {
          en: { name: 'English Name' },
        },
      });

      expect(getTranslatedWidgetName(widget, 'de')).toBe('English Name');
    });

    it('falls back to widget.name when locale is missing or translations are unavailable', () => {
      const widgetWithoutTranslations = createWidget();
      const widgetWithTranslations = createWidget({
        translations: {
          en: { name: 'English Name' },
        },
      });

      expect(getTranslatedWidgetName(widgetWithoutTranslations, 'sv')).toBe(
        'Default Name'
      );
      expect(getTranslatedWidgetName(widgetWithTranslations)).toBe(
        'Default Name'
      );
    });
  });

  describe('getTranslatedWidgetDescription', () => {
    it('returns locale-specific description when available', () => {
      const widget = createWidget({
        translations: {
          sv: { description: 'Svensk beskrivning' },
          en: { description: 'English description' },
        },
      });

      expect(getTranslatedWidgetDescription(widget, 'sv')).toBe(
        'Svensk beskrivning'
      );
    });

    it('falls back to English description, then widget.description', () => {
      const widgetWithEnglish = createWidget({
        translations: {
          en: { description: 'English description' },
        },
      });
      const widgetWithoutDescriptions = createWidget({
        description: undefined,
        translations: {
          sv: {},
        },
      });

      expect(getTranslatedWidgetDescription(widgetWithEnglish, 'de')).toBe(
        'English description'
      );
      expect(
        getTranslatedWidgetDescription(widgetWithoutDescriptions, 'sv')
      ).toBe(undefined);
    });
  });

  describe('getTranslatedWidgetOption', () => {
    it('returns locale-specific option field when available', () => {
      const widget = createWidget({
        translations: {
          sv: {
            options: {
              title: { label: 'Titel' },
            },
          },
          en: {
            options: {
              title: { label: 'Title' },
            },
          },
        },
      });

      expect(
        getTranslatedWidgetOption(widget, 'title', 'label', 'Fallback', 'sv')
      ).toBe('Titel');
    });

    it('falls back to English option field when locale option is missing', () => {
      const widget = createWidget({
        translations: {
          en: {
            options: {
              title: { placeholder: 'Enter title' },
            },
          },
        },
      });

      expect(
        getTranslatedWidgetOption(
          widget,
          'title',
          'placeholder',
          'Fallback',
          'de'
        )
      ).toBe('Enter title');
    });

    it('falls back to provided fallback when locale is missing, translations are missing, or field is missing', () => {
      const widget = createWidget({
        translations: {
          en: {
            options: {
              title: { label: 'Title' },
            },
          },
        },
      });

      expect(
        getTranslatedWidgetOption(
          widget,
          'title',
          'description',
          'Fallback',
          'sv'
        )
      ).toBe('Fallback');
      expect(
        getTranslatedWidgetOption(widget, 'title', 'label', 'Fallback')
      ).toBe('Fallback');
      expect(
        getTranslatedWidgetOption(
          createWidget(),
          'title',
          'label',
          'Fallback',
          'sv'
        )
      ).toBe('Fallback');
    });
  });
});
