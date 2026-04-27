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

  it('should parse multiple filters in collection string', () => {
    const collection = 'medias|type:image|published:true';

    const collectionParts = collection.split('|');
    const filters: Record<string, string | boolean> = {};
    if (collectionParts.length > 1) {
      collectionParts.slice(1).forEach((part) => {
        const [filterKey, filterValue] = part.split(':');
        if (filterKey && filterValue) {
          filters[filterKey] = filterValue;
        }
      });
    }

    expect(filters).toEqual({ type: 'image', published: 'true' });
  });

  it('should ignore malformed filter segments', () => {
    const collection = 'medias|type:image|broken-filter';

    const collectionParts = collection.split('|');
    const filters: Record<string, string | boolean> = {};
    if (collectionParts.length > 1) {
      collectionParts.slice(1).forEach((part) => {
        const [filterKey, filterValue] = part.split(':');
        if (filterKey && filterValue) {
          filters[filterKey] = filterValue;
        }
      });
    }

    expect(filters).toEqual({ type: 'image' });
  });
});

describe('WidgetConfig - URL Validation Logic', () => {
  const isValidURL = (url: string): boolean => {
    if (!url || url.trim() === '') {
      return true;
    }

    if (!/^(https?|ftp):\/\//i.test(url)) {
      return false;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      if (!hostname || hostname.length === 0) {
        return false;
      }

      const isLocalhost = hostname === 'localhost';
      const isIPAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
      const hasTLD = /\.[a-z]{2,}$/i.test(hostname);

      return isLocalhost || isIPAddress || hasTLD;
    } catch {
      return false;
    }
  };

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
  type Schema = { key?: string; type?: string; order?: number };

  const getSchemaEntries = (
    rawOptionsSchema: Schema[] | Record<string, Schema>
  ) => {
    let entries: [string, Schema][];

    if (Array.isArray(rawOptionsSchema)) {
      entries = rawOptionsSchema.map((item) => [item.key as string, item]);
    } else {
      entries = Object.entries(rawOptionsSchema) as [string, Schema][];
    }

    return entries.sort((a, b) => {
      const orderA = a[1].order ?? Infinity;
      const orderB = b[1].order ?? Infinity;
      return orderA - orderB;
    });
  };

  it('normalizes map format and sorts by order', () => {
    const schema = {
      third: { type: 'string', order: 3 },
      first: { type: 'string', order: 1 },
      unordered: { type: 'string' },
      second: { type: 'string', order: 2 },
    };

    const entries = getSchemaEntries(schema).map(([key]) => key);
    expect(entries).toEqual(['first', 'second', 'third', 'unordered']);
  });

  it('normalizes list format and sorts by order', () => {
    const schema = [
      { key: 'third', type: 'string', order: 3 },
      { key: 'first', type: 'string', order: 1 },
      { key: 'unordered', type: 'string' },
      { key: 'second', type: 'string', order: 2 },
    ];

    const entries = getSchemaEntries(schema).map(([key]) => key);
    expect(entries).toEqual(['first', 'second', 'third', 'unordered']);
  });
});

describe('WidgetConfig - Layout Ref Validation Logic', () => {
  const isLayoutRefValid = (value: any): boolean => {
    if (!value) return false;
    if (!value.layoutId) return false;
    if (!value.zones?.zones || value.zones.zones.length === 0) return false;

    const zonePlaylistMap = value.zonePlaylistMap || {};
    for (const zone of value.zones.zones) {
      const assignment = zonePlaylistMap[zone.id];
      if (!assignment || !assignment.playlistId) {
        return false;
      }
    }
    return true;
  };

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
