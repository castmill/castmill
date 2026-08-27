/**
 * Tests for WidgetConfig collection parsing logic
 */
import { describe, it, expect } from 'vitest';
import {
  parseCollectionFilters,
  getMediaPlaceholderText,
  isValidURL,
  normalizeSchemaEntries,
  isLayoutRefValid,
} from './widget-config';

describe('WidgetConfig - Collection Parsing', () => {
  it('should parse collection string with media type filter', () => {
    const { collectionName, filters } =
      parseCollectionFilters('medias|type:video');

    expect(collectionName).toBe('medias');
    expect(filters).toEqual({ type: 'video' });
  });

  it('should parse collection string for image media type', () => {
    const { collectionName, filters } =
      parseCollectionFilters('medias|type:image');

    expect(collectionName).toBe('medias');
    expect(filters).toEqual({ type: 'image' });
  });

  it('should handle collection string without filters', () => {
    const { collectionName, filters } = parseCollectionFilters('medias');

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

    const placeholderText = getMediaPlaceholderText(filters, t);

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

    const placeholderText = getMediaPlaceholderText(filters, t);

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

    const placeholderText = getMediaPlaceholderText(filters, t);

    expect(placeholderText).toBe('Select a Media');
  });

  it('should parse multiple filters in collection string', () => {
    const { filters } = parseCollectionFilters(
      'medias|type:image|published:true'
    );

    expect(filters).toEqual({ type: 'image', published: 'true' });
  });

  it('should ignore malformed filter segments', () => {
    const { filters } = parseCollectionFilters(
      'medias|type:image|broken-filter'
    );

    expect(filters).toEqual({ type: 'image' });
  });
});

describe('WidgetConfig - URL Validation Logic', () => {
  it('accepts valid https URL with TLD', () => {
    expect(isValidURL('https://example.com/path')).toBe(true);
  });

  it('accepts localhost and ip addresses', () => {
    expect(isValidURL('http://localhost:3000')).toBe(true);
    expect(isValidURL('ftp://192.168.1.10/file.txt')).toBe(true);
  });

  it('rejects malformed protocol or missing slashes', () => {
    expect(isValidURL('https:example.com')).toBe(false);
    expect(isValidURL('example.com')).toBe(false);
  });

  it('treats empty values as valid because required validation is separate', () => {
    expect(isValidURL('')).toBe(true);
    expect(isValidURL('   ')).toBe(true);
  });
});

describe('WidgetConfig - Schema Entries Normalization', () => {
  it('normalizes map format and sorts by order', () => {
    const schema = {
      third: { type: 'string', order: 3 },
      first: { type: 'string', order: 1 },
      unordered: { type: 'string' },
      second: { type: 'string', order: 2 },
    };

    const entries = normalizeSchemaEntries(schema).map(([key]) => key);
    expect(entries).toEqual(['first', 'second', 'third', 'unordered']);
  });

  it('normalizes list format and sorts by order', () => {
    const schema = [
      { key: 'third', type: 'string', order: 3 },
      { key: 'first', type: 'string', order: 1 },
      { key: 'unordered', type: 'string' },
      { key: 'second', type: 'string', order: 2 },
    ];

    const entries = normalizeSchemaEntries(schema).map(([key]) => key);
    expect(entries).toEqual(['first', 'second', 'third', 'unordered']);
  });
});

describe('WidgetConfig - Layout Ref Validation Logic', () => {
  it('returns true when all zones have playlist assignments', () => {
    const value = {
      layoutId: 10,
      zones: { zones: [{ id: 'a' }, { id: 'b' }] },
      zonePlaylistMap: {
        a: { playlistId: 1 },
        b: { playlistId: 2 },
      },
    };

    expect(isLayoutRefValid(value)).toBe(true);
  });

  it('returns false when one zone is missing playlist assignment', () => {
    const value = {
      layoutId: 10,
      zones: { zones: [{ id: 'a' }, { id: 'b' }] },
      zonePlaylistMap: {
        a: { playlistId: 1 },
      },
    };

    expect(isLayoutRefValid(value)).toBe(false);
  });

  it('returns false for missing layout id or empty zones', () => {
    expect(isLayoutRefValid({})).toBe(false);
    expect(isLayoutRefValid({ layoutId: 10, zones: { zones: [] } })).toBe(
      false
    );
  });
});
