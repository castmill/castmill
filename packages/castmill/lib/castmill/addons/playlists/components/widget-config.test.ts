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
  isLocationValueValid,
  normalizeFormValue,
  normalizeWidgetOptionsForApi,
  resolvePlaybackLocale,
  getFieldChoices,
  choiceDependencies,
  dependentChoiceFields,
  validateChoicesValue,
  choicesErrorMessage,
  choicesFieldLabels,
  type SchemaAttributeType,
} from './widget-config';
import { WidgetChoicesError } from '../services/playlists.service';

describe('WidgetConfig - Playback Locale', () => {
  it('uses the network display locale instead of the dashboard language', () => {
    expect(resolvePlaybackLocale('sv')).toBe('sv');
  });

  it('defaults to English when no network display locale is available', () => {
    expect(resolvePlaybackLocale()).toBe('en');
  });
});

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

describe('WidgetConfig - Layout Ref API normalization', () => {
  it('converts legacy primitive zone assignments to canonical playlistId objects', () => {
    expect(
      normalizeWidgetOptionsForApi(
        {
          layoutRef: {
            layoutId: 10,
            aspectRatio: '16:9',
            zones: { zones: [] },
            zonePlaylistMap: {
              zoneA: 123,
              zoneAString: '789',
              zoneB: { playlistId: 456, playlist: { id: 456 } },
            },
          },
        },
        [['layoutRef', { type: 'layout-ref' } as SchemaAttributeType]]
      )
    ).toEqual({
      layoutRef: {
        layoutId: 10,
        aspectRatio: '16:9',
        zones: { zones: [] },
        zonePlaylistMap: {
          zoneA: { playlistId: 123 },
          zoneAString: { playlistId: 789 },
          zoneB: { playlistId: 456 },
        },
      },
    });
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

describe('WidgetConfig - Location Validation Logic', () => {
  it('returns true for valid location coordinates', () => {
    expect(isLocationValueValid({ lat: 51.505, lng: -0.09 })).toBe(true);
  });

  it('returns false for missing or non-numeric coordinates', () => {
    expect(isLocationValueValid(undefined)).toBe(false);
    expect(
      isLocationValueValid({ lat: '51.505' as any, lng: -0.09 } as any)
    ).toBe(false);
    expect(isLocationValueValid({ lat: 51.505, lng: NaN } as any)).toBe(false);
  });

  it('returns false for out-of-range coordinates', () => {
    expect(isLocationValueValid({ lat: 91, lng: 0 } as any)).toBe(false);
    expect(isLocationValueValid({ lat: 0, lng: -181 } as any)).toBe(false);
  });
});

describe('WidgetConfig - Form Value Normalization', () => {
  it('preserves boolean values for checkbox fields', () => {
    expect(normalizeFormValue(false)).toBe(false);
    expect(normalizeFormValue(true)).toBe(true);
  });

  it('falls back to an empty string for object values', () => {
    expect(normalizeFormValue({ value: true })).toBe('');
  });
});

describe('WidgetConfig - API Option Normalization', () => {
  it('removes expanded playlists from layout references', () => {
    const circularPlaylist: Record<string, unknown> = {
      id: 11,
      name: 'Zone playlist',
    };
    circularPlaylist._prev = circularPlaylist;

    const options = {
      layoutRef: {
        layoutId: 3,
        aspectRatio: '16:9',
        zones: {
          zones: [
            {
              id: 'zone-1',
              name: 'Left',
              rect: { x: 0, y: 0, width: 50, height: 100 },
              zIndex: 1,
            },
          ],
        },
        zonePlaylistMap: {
          'zone-1': {
            playlistId: 11,
            playlist: circularPlaylist,
          },
        },
      },
    };
    const schemaEntries: [string, SchemaAttributeType][] = [
      ['layoutRef', { type: 'layout-ref' }],
    ];

    const normalized = normalizeWidgetOptionsForApi(options, schemaEntries);

    expect(normalized.layoutRef.zonePlaylistMap).toEqual({
      'zone-1': { playlistId: 11 },
    });
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it('converts standard reference objects to ids', () => {
    const normalized = normalizeWidgetOptionsForApi(
      { media: { id: 42, name: 'Image' } },
      [
        [
          'media',
          { type: 'ref', collection: 'medias' } satisfies SchemaAttributeType,
        ],
      ]
    );

    expect(normalized).toEqual({ media: 42 });
  });
});

describe('WidgetConfig - Choices', () => {
  const t = (key: string, params?: Record<string, any>) =>
    params ? `${key} ${JSON.stringify(params)}` : key;

  const listing = {
    type: 'string',
    required: true,
    choices: { list: 'listings', display: 'cards' },
  } as unknown as SchemaAttributeType;

  const photos = {
    type: 'list',
    items: { type: 'string' },
    choices: {
      list: 'images',
      multiple: true,
      min: 1,
      max: 2,
      depends_on: ['listing'],
    },
  } as unknown as SchemaAttributeType;

  it('detects choice fields', () => {
    expect(getFieldChoices(listing)).toEqual({
      list: 'listings',
      display: 'cards',
    });
    expect(getFieldChoices('string')).toBeUndefined();
    expect(getFieldChoices({ type: 'string' })).toBeUndefined();
    expect(getFieldChoices({ choices: { display: 'grid' } })).toBeUndefined();
    expect(getFieldChoices(null)).toBeUndefined();
  });

  it('splits dependency values and missing dependencies', () => {
    const choices = getFieldChoices(photos)!;

    expect(choiceDependencies(choices, { listing: 'L1', other: 1 })).toEqual({
      values: { listing: 'L1' },
      missing: [],
    });
    expect(choiceDependencies(choices, { listing: '' })).toEqual({
      values: {},
      missing: ['listing'],
    });
    expect(choiceDependencies(getFieldChoices(listing)!, {})).toEqual({
      values: {},
      missing: [],
    });
  });

  it('finds dependent choice fields that have values', () => {
    const entries: [string, SchemaAttributeType][] = [
      ['listing', listing],
      ['photos', photos],
      ['title', 'string' as SchemaAttributeType],
    ];

    expect(
      dependentChoiceFields(entries, 'listing', { photos: ['p1'] })
    ).toEqual(['photos']);
    expect(dependentChoiceFields(entries, 'listing', { photos: [] })).toEqual(
      []
    );
    expect(
      dependentChoiceFields(entries, 'photos', { photos: ['p1'] })
    ).toEqual([]);
  });

  it('finds transitive values through empty dependent choice fields', () => {
    const calendar: SchemaAttributeType = {
      type: 'string',
      choices: { list: 'calendars', depends_on: ['listing'] },
    };
    const event: SchemaAttributeType = {
      type: 'string',
      choices: { list: 'events', depends_on: ['calendar'] },
    };
    const entries: [string, SchemaAttributeType][] = [
      ['listing', listing],
      ['calendar', calendar],
      ['event', event],
    ];

    expect(
      dependentChoiceFields(entries, 'listing', { calendar: '', event: 'e1' })
    ).toEqual(['event']);
    expect(
      dependentChoiceFields(entries, 'listing', {
        calendar: 'c1',
        event: 'e1',
      })
    ).toEqual(['calendar', 'event']);
  });

  it('validates required values and selection bounds', () => {
    const single = getFieldChoices(listing)!;
    const multiple = getFieldChoices(photos)!;

    expect(validateChoicesValue(single, true, undefined, t)).toBe(
      'validation.fieldRequired'
    );
    expect(validateChoicesValue(single, true, 'L1', t)).toBe('');
    expect(validateChoicesValue(single, false, '', t)).toBe('');
    expect(validateChoicesValue(multiple, false, [], t)).toBe(
      'widgets.choices.minSelection {"min":1}'
    );
    expect(validateChoicesValue(multiple, false, ['a', 'b', 'c'], t)).toBe(
      'widgets.choices.maxSelection {"max":2}'
    );
    expect(validateChoicesValue(multiple, false, ['a'], t)).toBe('');
  });

  it('maps endpoint errors to localized messages', () => {
    expect(
      choicesErrorMessage(new WidgetChoicesError('provider_error', 502), t)
    ).toBe('widgets.choices.errors.providerError');
    expect(
      choicesErrorMessage(new WidgetChoicesError('missing_credentials'), t)
    ).toBe('widgets.choices.errors.missingCredentials');
    expect(choicesErrorMessage(new WidgetChoicesError('teapot'), t)).toBe(
      'widgets.choices.errors.unknown'
    );
    expect(choicesErrorMessage(new Error('boom'), t)).toBe(
      'widgets.choices.errors.unknown'
    );
  });

  it('builds field labels from translations', () => {
    const labels = choicesFieldLabels(t);

    expect(labels.choose).toBe('widgets.choices.choose');
    expect(labels.cancel).toBe('common.cancel');
    expect(labels.selected(3)).toBe(
      'widgets.choices.selectedCount {"count":3}'
    );
    expect(labels.selected(3, 5)).toBe(
      'widgets.choices.selectedCountMax {"count":3,"max":5}'
    );
  });
});
