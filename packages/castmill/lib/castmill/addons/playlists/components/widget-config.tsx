import { Component, For, createEffect, createSignal, Show } from 'solid-js';
import { authFetch } from '../../common/services/auth-fetch';
import {
  JsonPlaylistItem,
  JsonPlaylist,
  JsonMedia,
  FieldAttributes,
  SimpleType,
  ReferenceAttributes,
  ComplexFieldAttributes,
  OptionsDict,
  JsonWidgetConfig,
  LayoutFieldAttributes,
  LayoutOptionValue,
  LayoutRefFieldAttributes,
  LayoutRefValue,
  LocationValue,
  LocationFieldAttributes,
} from '@castmill/player';
import { BsCheckLg } from 'solid-icons/bs';
import { BsX } from 'solid-icons/bs';
import {
  FormItem,
  Button,
  ComboBox,
  useToast,
  Timestamp,
  LocationPicker,
} from '@castmill/ui-common';
import { ResourcesService } from '../services/resources.service';
import { PlaylistsService } from '../services/playlists.service';
import { AddonStore } from '../../common/interfaces/addon-store';
import { getTranslatedWidgetOption } from '../../common/utils/widget-catalog-utils';

import './widget-config.scss';
import { WidgetView } from './widget-view';
import { LayoutEditor } from '../../common/components/layout-editor';
import { LayoutRefEditor } from '../../common/components/layout-ref-editor';

/**
 * WidgetConfig
 *
 * This component allows to configure a widget. It dynamically creates a form based on the widget's options_schema.
 *
 * @param props
 */

interface WidgetConfigProps {
  store: AddonStore;
  baseUrl: string;
  item: JsonPlaylistItem;
  organizationId: string;
  playlistId: number;
  onSubmit: (value: {
    config: Partial<JsonWidgetConfig>;
    expandedOptions: OptionsDict;
  }) => Promise<void>;
}

type FormTypes =
  | 'text'
  | 'number'
  | 'boolean'
  | 'ref'
  | 'color'
  | 'url'
  | 'select'
  | 'layout'
  | 'layout-ref'
  | 'location'
  | 'map'
  | 'list';

export type SchemaAttributeType =
  | SimpleType
  | FieldAttributes
  | ComplexFieldAttributes
  | ReferenceAttributes
  | LayoutFieldAttributes
  | LayoutRefFieldAttributes
  | LocationFieldAttributes;

export const normalizeSchemaEntries = (
  rawOptionsSchema: unknown
): [string, SchemaAttributeType][] => {
  let entries: [string, SchemaAttributeType][];

  if (Array.isArray(rawOptionsSchema)) {
    entries = rawOptionsSchema.map(
      (item: any) => [item.key, item] as [string, SchemaAttributeType]
    );
  } else {
    entries = Object.entries(
      (rawOptionsSchema || {}) as Record<string, SchemaAttributeType>
    ) as [string, SchemaAttributeType][];
  }

  return entries.sort((a, b) => {
    const orderA = (a[1] as FieldAttributes).order ?? Infinity;
    const orderB = (b[1] as FieldAttributes).order ?? Infinity;
    return orderA - orderB;
  });
};

export const isLayoutRefValid = (
  value: LayoutRefValue | null | undefined
): boolean => {
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

export function isValidURL(url: string): boolean {
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
}

export const parseCollectionFilters = (
  collection: string
): { collectionName: string; filters: Record<string, string | boolean> } => {
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

  return { collectionName, filters };
};

export const getMediaPlaceholderText = (
  filters: Record<string, string | boolean>,
  t: (key: string) => string
): string =>
  filters['type'] === 'image'
    ? t('common.selectImage')
    : filters['type'] === 'video'
      ? t('common.selectVideo')
      : t('common.selectMedia');

export const WidgetConfig: Component<WidgetConfigProps> = (props) => {
  const toast = useToast();
  const [widgetConfig, setWidgetConfig] = createSignal(props.item.config);
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [isFormValid, setIsFormValid] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());
  // Initialize with current playlist ID to prevent self-selection immediately
  const [excludedPlaylistIds, setExcludedPlaylistIds] = createSignal<number[]>([
    props.playlistId,
  ]);

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
  const locale = () => props.store.i18n?.locale() || 'en';

  const translateWidgetOptionLabel = (
    optionKey: string,
    fallback?: string
  ): string =>
    getTranslatedWidgetOption(
      props.item.widget,
      optionKey,
      'label',
      fallback,
      locale()
    ) ??
    fallback ??
    optionKey;

  const translateWidgetOptionDescription = (
    optionKey: string,
    fallback?: string
  ): string | undefined =>
    getTranslatedWidgetOption(
      props.item.widget,
      optionKey,
      'description',
      fallback,
      locale()
    );

  const translateWidgetOptionPlaceholder = (
    optionKey: string,
    fallback?: string
  ): string | undefined =>
    getTranslatedWidgetOption(
      props.item.widget,
      optionKey,
      'placeholder',
      fallback,
      locale()
    );

  // Fetch ancestor playlist IDs to prevent circular references
  createEffect(async () => {
    try {
      const response = await authFetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/playlists/${props.playlistId}/ancestors`
      );
      if (response.ok) {
        const data = await response.json();
        // Include the current playlist and its ancestors in the exclusion list
        setExcludedPlaylistIds([
          props.playlistId,
          ...(data.ancestor_ids || []),
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch playlist ancestors:', error);
      // At minimum, exclude the current playlist itself
      setExcludedPlaylistIds([props.playlistId]);
    }
  });

  const rawOptionsSchema = props.item.widget.options_schema || {};

  const schemaEntries = normalizeSchemaEntries(rawOptionsSchema);

  if (!rawOptionsSchema || schemaEntries.length === 0) {
    return <div>{t('common.noConfigurationAvailable')}</div>;
  }

  const copyOptions = (options: Record<string, any>) => {
    // Use a safe deep clone that handles circular references
    const seen = new WeakSet();
    const safeClone = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (seen.has(obj)) return undefined; // Skip circular references
      seen.add(obj);
      if (Array.isArray(obj)) return obj.map(safeClone);
      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = safeClone(obj[key]);
        }
      }
      return result;
    };
    return safeClone(options);
  };

  const setDefaultOptions = (options: Record<string, any>) => {
    const entries = schemaEntries;
    for (const [key, schema] of entries) {
      if (
        typeof options[key] === 'undefined' &&
        typeof (schema as FieldAttributes).default !== 'undefined'
      ) {
        options[key] = (schema as FieldAttributes).default;
      }
    }
    return options;
  };

  const originalOptions = setDefaultOptions(
    copyOptions(props.item.config.options || {})
  );

  const [widgetOptions, setWidgetOptions] =
    createSignal<OptionsDict>(originalOptions);

  /**
   * Gets the form type for a schema entry.
   */
  const getFormType = (schema: any): FormTypes => {
    // If it's an object schema with enum, render as select
    if (schema && typeof schema === 'object' && schema.enum) {
      return 'select';
    }
    const schemaType = schema?.type || schema;
    switch (schemaType) {
      case 'string':
        return 'text';
      case 'integer':
        return 'number';
      default:
        return schemaType;
    }
  };

  const checkFormValidity = () => {
    const entries = schemaEntries;
    const options = widgetOptions();

    for (const [key, schema] of entries) {
      // Check layout-ref fields have all zones assigned
      const fieldType = getFormType(schema);
      if (fieldType === 'layout-ref') {
        const layoutRefValue = options[key] as
          | LayoutRefValue
          | null
          | undefined;
        if (!isLayoutRefValid(layoutRefValue)) {
          return false;
        }
      }

      if (
        (schema as FieldAttributes).required &&
        typeof (schema as FieldAttributes).default === 'undefined' &&
        typeof options[key] === 'undefined'
      ) {
        return false;
      }

      if (errors().get(key)) {
        return false;
      }
    }

    return true;
  };

  const validateField = (
    type: FormTypes,
    schema: FieldAttributes | SimpleType,
    key: string,
    value: any
  ) => {
    let errorMessage;

    const fieldAttrs = schema as FieldAttributes;

    if (fieldAttrs.required && !value) {
      errorMessage = 'This field is required';
    }

    switch (type) {
      case 'text':
        break;
      case 'number':
        if (isNaN(value)) {
          errorMessage = 'This field must be a number';
        } else if (fieldAttrs.min && value < fieldAttrs.min) {
          errorMessage = `This field must be greater than ${fieldAttrs.min}`;
        } else if (fieldAttrs.max && value > fieldAttrs.max) {
          errorMessage = `This field must be less than ${fieldAttrs.max}`;
        }
        break;
      case 'boolean':
        break;
      case 'color':
        break;
      case 'url':
        if (!isValidURL(value)) {
          errorMessage = 'This field must be a valid URL';
        }
        break;
      case 'ref':
        break;
      case 'map':
        break;
      case 'list':
        break;
      default:
        errorMessage = `Unknown type: ${type}`;
    }

    if (errorMessage) {
      setErrors((prev) => new Map(prev).set(key, errorMessage));
      return false;
    } else {
      setErrors((prev) => new Map(prev).set(key, ''));
      return true;
    }
  };

  const getValue = (
    key: string,
    schema: { default?: any }
  ): string | number | boolean | object | null => {
    const options = widgetOptions();
    return options[key] ?? schema.default ?? '';
  };

  /**
   * Gets a reference value (media or playlist) from widget options.
   * Returns undefined if the value is not an object with the expected type.
   */
  const getReferenceValue = <T extends object>(key: string): T | undefined => {
    const value = widgetOptions()[key];
    if (value && typeof value === 'object') {
      return value as T;
    }
    return undefined;
  };

  /**
   * Maps JSON Schema types to form field types.
   * Also handles special cases like enums (which render as select dropdowns).
   */
  const getType = (value: any): FormTypes => {
    // If it's an object schema with enum, render as select
    if (value && typeof value === 'object' && value.enum) {
      return 'select';
    }

    const schemaType = value?.type || value;

    // Map JSON Schema types to form types
    switch (schemaType) {
      case 'string':
        return 'text';
      case 'integer':
        return 'number';
      default:
        return schemaType;
    }
  };

  // Re-validate form whenever widgetOptions or errors change
  // Note: checkFormValidity reads widgetOptions() and errors(),
  // so SolidJS will automatically track these dependencies
  createEffect(() => {
    // Read signals to create dependencies
    widgetOptions();
    errors();
    // Now check validity
    setIsFormValid(checkFormValidity());
  });

  function componentForItem(
    key: string,
    schema:
      | FieldAttributes
      | ReferenceAttributes
      | SimpleType
      | ComplexFieldAttributes
      | LayoutFieldAttributes
      | LayoutRefFieldAttributes
      | LocationFieldAttributes
  ) {
    const type = getType(schema);
    switch (type) {
      case 'text':
      case 'number':
      case 'boolean':
      case 'color':
      case 'url':
        const fieldSchema = schema as FieldAttributes & {
          title?: string;
          placeholder?: string;
        };
        const formValue = getValue(key, fieldSchema);
        return (
          <FormItem
            label={translateWidgetOptionLabel(key, fieldSchema.title || key)}
            id={key}
            type={type}
            value={typeof formValue === 'object' ? '' : String(formValue ?? '')}
            placeholder={translateWidgetOptionPlaceholder(
              key,
              fieldSchema.placeholder
            )}
            description={translateWidgetOptionDescription(
              key,
              fieldSchema.description
            )}
            onInput={(value: string | number | boolean) => {
              if (validateField(type, fieldSchema, key, value)) {
                setWidgetOptions({ ...widgetOptions(), [key]: value });
                setIsFormModified(true);
              }
              setIsFormValid(checkFormValidity());
            }}
          >
            <div class="error">{errors().get(key)}</div>
          </FormItem>
        );
      case 'select':
        // Handle enum fields as dropdown selects
        const enumSchema = schema as {
          enum?: string[];
          default?: string;
          description?: string;
        };
        const enumOptions = enumSchema.enum || [];
        const currentValue = getValue(key, enumSchema) as string;

        return (
          <div class="form-item-wrapper">
            <div class="form-item1">
              <label for={key}>{translateWidgetOptionLabel(key, key)}</label>
              <select
                id={key}
                value={currentValue}
                onChange={(e) => {
                  const newValue = e.currentTarget.value;
                  setWidgetOptions({ ...widgetOptions(), [key]: newValue });
                  setIsFormModified(true);
                  setIsFormValid(checkFormValidity());
                }}
                class="styled-select"
              >
                {enumOptions.map((option) => (
                  <option value={option} selected={option === currentValue}>
                    {option}
                  </option>
                ))}
              </select>
              <div class="error">{errors().get(key)}</div>
            </div>
            <Show when={enumSchema.description}>
              <div class="description">
                {translateWidgetOptionDescription(key, enumSchema.description)}
              </div>
            </Show>
          </div>
        );
      case 'ref':
        const collection = (schema as ReferenceAttributes).collection;

        const { collectionName, filters } = parseCollectionFilters(collection);
        const placeholderText = getMediaPlaceholderText(filters, t);

        switch (collectionName) {
          case 'medias':
            return (
              <>
                <ComboBox<JsonMedia>
                  id={key}
                  label={translateWidgetOptionLabel(key, key)}
                  placeholder={placeholderText}
                  value={getReferenceValue<JsonMedia>(key)}
                  renderItem={(item: JsonMedia) => {
                    return (
                      <div class="media-item">
                        <div
                          class="thumbnail"
                          style={{
                            'background-image': `url(${item.files['thumbnail']?.uri})`,
                          }}
                        ></div>
                        <div>{item.name}</div>
                      </div>
                    );
                  }}
                  fetchItems={async (
                    page: number,
                    pageSize: number,
                    search: string
                  ) => {
                    return ResourcesService.fetch<JsonMedia>(
                      props.baseUrl,
                      props.organizationId,
                      collectionName,
                      {
                        page,
                        page_size: pageSize,
                        search,
                        filters:
                          Object.keys(filters).length > 0 ? filters : undefined,
                      }
                    );
                  }}
                  onSelect={(media: JsonMedia) => {
                    setWidgetOptions({ ...widgetOptions(), [key]: media });
                    setIsFormModified(true);
                    setIsFormValid(checkFormValidity());
                  }}
                />
                <div class="error">{errors().get(key)}</div>
              </>
            );
          case 'playlists':
            return (
              <>
                <ComboBox<JsonPlaylist>
                  id={key}
                  label={translateWidgetOptionLabel(key, key)}
                  placeholder={t('common.selectPlaylist')}
                  value={getReferenceValue<JsonPlaylist>(key)}
                  renderItem={(item: JsonPlaylist) => {
                    return (
                      <div class="playlist-item">
                        <div>{item.name}</div>
                      </div>
                    );
                  }}
                  fetchItems={async (
                    page: number,
                    pageSize: number,
                    search: string
                  ) => {
                    // Filter out playlists that would cause circular references
                    const excluded = excludedPlaylistIds();
                    const filterParams: Record<string, string | boolean> = {};
                    if (excluded.length > 0) {
                      filterParams.exclude_ids = excluded.join(',');
                    }
                    return ResourcesService.fetch<JsonPlaylist>(
                      props.baseUrl,
                      props.organizationId,
                      collectionName,
                      {
                        page,
                        page_size: pageSize,
                        search,
                        filters:
                          Object.keys(filterParams).length > 0
                            ? filterParams
                            : undefined,
                      }
                    );
                  }}
                  onSelect={async (playlist: JsonPlaylist) => {
                    // Fetch the full playlist with items for proper preview rendering
                    // The list endpoint returns playlists without items loaded
                    try {
                      const fullPlaylist = await PlaylistsService.getPlaylist(
                        props.baseUrl,
                        props.organizationId,
                        playlist.id
                      );
                      setWidgetOptions({
                        ...widgetOptions(),
                        [key]: fullPlaylist,
                      });
                    } catch (error) {
                      // Fallback to the basic playlist if full fetch fails
                      console.warn(
                        'Failed to fetch full playlist, using basic data:',
                        error
                      );
                      setWidgetOptions({ ...widgetOptions(), [key]: playlist });
                    }
                    setIsFormModified(true);
                    setIsFormValid(checkFormValidity());
                  }}
                />
                <div class="error">{errors().get(key)}</div>
              </>
            );
          default:
            throw new Error(
              t('errors.unknownResourceType', { resourceType: collectionName })
            );
        }
      case 'layout':
        const layoutSchema = schema as LayoutFieldAttributes;
        const defaultLayout: LayoutOptionValue = layoutSchema.default || {
          aspectRatio: '16:9',
          zones: [],
        };
        // Use a getter function to ensure reactivity - widgetOptions() is a signal
        const getCurrentLayout = () =>
          (widgetOptions()[key] as LayoutOptionValue) || defaultLayout;

        return (
          <div class="form-item-wrapper">
            <label>{translateWidgetOptionLabel(key, key)}</label>
            <Show when={layoutSchema.description}>
              <div class="description">
                {translateWidgetOptionDescription(
                  key,
                  layoutSchema.description
                )}
              </div>
            </Show>
            <LayoutEditor
              value={getCurrentLayout()}
              schema={layoutSchema}
              onChange={(newValue: LayoutOptionValue) => {
                setWidgetOptions({ ...widgetOptions(), [key]: newValue });
                setIsFormModified(true);
                setIsFormValid(checkFormValidity());
              }}
              organizationId={props.organizationId}
              baseUrl={props.baseUrl}
            />
          </div>
        );
      case 'layout-ref':
        const layoutRefSchema = schema as LayoutRefFieldAttributes;
        const getCurrentLayoutRef = () =>
          (widgetOptions()[key] as LayoutRefValue) || null;

        return (
          <div class="form-item-wrapper">
            <Show when={layoutRefSchema.description}>
              <div class="description">
                {translateWidgetOptionDescription(
                  key,
                  layoutRefSchema.description
                )}
              </div>
            </Show>
            <LayoutRefEditor
              value={getCurrentLayoutRef()}
              onChange={(newValue: LayoutRefValue | null) => {
                const newOptions = { ...widgetOptions() };
                if (newValue === null) {
                  delete newOptions[key];
                } else {
                  newOptions[key] = newValue;
                }
                setWidgetOptions(newOptions);
                setIsFormModified(true);
                setIsFormValid(checkFormValidity());
              }}
              organizationId={props.organizationId}
              baseUrl={props.baseUrl}
              t={t}
              excludedPlaylistIds={excludedPlaylistIds()}
            />
          </div>
        );
      case 'location':
        const locationSchema = schema as LocationFieldAttributes;
        const getCurrentLocation = () =>
          (widgetOptions()[key] as LocationValue) ||
          locationSchema.default ||
          null;

        return (
          <div class="form-item-wrapper">
            <Show when={locationSchema.description}>
              <div class="description">
                {translateWidgetOptionDescription(
                  key,
                  locationSchema.description
                )}
              </div>
            </Show>
            <LocationPicker
              value={getCurrentLocation()}
              onChange={(newValue: LocationValue) => {
                setWidgetOptions({ ...widgetOptions(), [key]: newValue });
                setIsFormModified(true);
                setIsFormValid(checkFormValidity());
              }}
              defaultZoom={locationSchema.defaultZoom}
              placeholder={t('common.searchLocation')}
              searchLabel={translateWidgetOptionLabel(key, key)}
              coordinatesLabel={t('common.coordinates')}
              addressLabel={t('common.address')}
              noAddressText={t('common.noAddressAvailable')}
              editLabel={t('common.edit')}
              saveLabel={t('common.save')}
              cancelLabel={t('common.cancel')}
            />
          </div>
        );
      case 'map':
        return <div>Map type not implemented yet</div>;
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  const resetForm = () => {
    setIsFormModified(false);
    setWidgetOptions(originalOptions);
  };

  return (
    <div class="widget-config-dialog">
      <div class="widget-config">
        <Show when={props.item.inserted_at}>
          <div style="font-size: 0.8em; color: darkgray;">
            <span>{t('common.addedOn')} </span>{' '}
            <Timestamp
              value={props.item.inserted_at!}
              mode="relative"
              locale={props.store.i18n?.locale?.()}
            />
            . <span>{t('common.lastUpdatedOn')} </span>
            <Timestamp
              value={props.item.updated_at!}
              mode="relative"
              locale={props.store.i18n?.locale?.()}
            />
          </div>
        </Show>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isFormValid()) {
              // For references we need to pick the ID, not the full expanded object
              const options = schemaEntries.reduce(
                (acc: Record<string, any>, [key, schema]) => {
                  const type = getType(schema);
                  if (type === 'ref') {
                    const value = widgetOptions()[key];
                    acc[key] =
                      value && typeof value === 'object'
                        ? (value as any).id
                        : value;
                  } else {
                    acc[key] = widgetOptions()[key];
                  }
                  return acc;
                },
                {}
              );

              try {
                await props.onSubmit({
                  config: { options },
                  expandedOptions: widgetOptions(),
                });

                // Update widgetConfig with the new options so WidgetView
                // can reactively fetch new integration data
                setWidgetConfig((prev) => ({
                  ...prev,
                  options: widgetOptions(),
                }));
              } catch (err) {
                toast.error(`Error submitting form ${(err as Error).message}`);
              }

              setIsFormModified(false);
            }
          }}
        >
          <div class="form-inputs">
            <For each={schemaEntries}>
              {([key, schema]) => {
                return componentForItem(key, schema);
              }}
            </For>
          </div>
          <div class="form-actions">
            <Button
              label={t('common.save')}
              type="submit"
              disabled={!isFormValid()}
              icon={BsCheckLg}
              color="success"
            />
            <Button
              label={t('common.reset')}
              disabled={!isFormModified()}
              onClick={() => {
                resetForm();
                setIsFormModified(false);
              }}
              icon={BsX}
              color="danger"
            />
          </div>
        </form>
      </div>
      <div class="preview">
        <WidgetView
          widget={props.item.widget}
          config={widgetConfig()}
          options={widgetOptions()}
          baseUrl={props.baseUrl}
          socket={props.store.socket}
        />
      </div>
    </div>
  );
};
