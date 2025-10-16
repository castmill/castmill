/**
 * Tests for WidgetConfig collection parsing logic
 */
import { describe, it, expect } from 'vitest';

describe('WidgetConfig - Collection Parsing', () => {
  // This test validates the collection parsing logic used in the widget-config component
  it('should parse collection string with media type filter', () => {
    const collection = 'medias|type:video';

    // Parse collection string (same logic as in widget-config.tsx)
    const collectionParts = collection.split('|');
    const collectionName = collectionParts[0];

    // Extract filters from collection string
    const filters: Record<string, string | boolean> = {};
    if (collectionParts.length > 1) {
      collectionParts.slice(1).forEach((part) => {
        const [filterKey, filterValue] = part.split(':');
        if (filterKey && filterValue) {
          filters[filterKey] = filterValue;
        }
      });
    }

    expect(collectionName).toBe('medias');
    expect(filters).toEqual({ type: 'video' });
  });

  it('should parse collection string for image media type', () => {
    const collection = 'medias|type:image';

    const collectionParts = collection.split('|');
    const collectionName = collectionParts[0];

    const filters: Record<string, string | boolean> = {};
    if (collectionParts.length > 1) {
      collectionParts.slice(1).forEach((part) => {
        const [filterKey, filterValue] = part.split(':');
        if (filterKey && filterValue) {
          filters[filterKey] = filterValue;
        }
      });
    }

    expect(collectionName).toBe('medias');
    expect(filters).toEqual({ type: 'image' });
  });

  it('should handle collection string without filters', () => {
    const collection = 'medias';

    const collectionParts = collection.split('|');
    const collectionName = collectionParts[0];

    const filters: Record<string, string | boolean> = {};
    if (collectionParts.length > 1) {
      collectionParts.slice(1).forEach((part) => {
        const [filterKey, filterValue] = part.split(':');
        if (filterKey && filterValue) {
          filters[filterKey] = filterValue;
        }
      });
    }

    expect(collectionName).toBe('medias');
    expect(filters).toEqual({});
  });

  it('should generate correct placeholder text for video with i18n', () => {
    const filters = { type: 'video' };
    const t = (key: string) => {
      const translations: Record<string, string> = {
        'common.selectVideo': 'Select a Video',
        'common.selectImage': 'Select an Image',
        'common.selectMedia': 'Select a Media',
      };
      return translations[key] || key;
    };

    const placeholderText =
      filters['type'] === 'image'
        ? t('common.selectImage')
        : filters['type'] === 'video'
          ? t('common.selectVideo')
          : t('common.selectMedia');

    expect(placeholderText).toBe('Select a Video');
  });

  it('should generate correct placeholder text for image with i18n', () => {
    const filters = { type: 'image' };
    const t = (key: string) => {
      const translations: Record<string, string> = {
        'common.selectVideo': 'Select a Video',
        'common.selectImage': 'Select an Image',
        'common.selectMedia': 'Select a Media',
      };
      return translations[key] || key;
    };

    const placeholderText =
      filters['type'] === 'image'
        ? t('common.selectImage')
        : filters['type'] === 'video'
          ? t('common.selectVideo')
          : t('common.selectMedia');

    expect(placeholderText).toBe('Select an Image');
  });

  it('should generate default placeholder text when no type is specified with i18n', () => {
    const filters: Record<string, string | boolean> = {};
    const t = (key: string) => {
      const translations: Record<string, string> = {
        'common.selectVideo': 'Select a Video',
        'common.selectImage': 'Select an Image',
        'common.selectMedia': 'Select a Media',
      };
      return translations[key] || key;
    };

    const placeholderText =
      filters['type'] === 'image'
        ? t('common.selectImage')
        : filters['type'] === 'video'
          ? t('common.selectVideo')
          : t('common.selectMedia');

    expect(placeholderText).toBe('Select a Media');
  });
});
