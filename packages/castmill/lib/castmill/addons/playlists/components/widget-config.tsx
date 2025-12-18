import { Component, For, createEffect, createSignal, Show } from 'solid-js';
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
} from '@castmill/player';
import { BsCheckLg } from 'solid-icons/bs';
import { BsX } from 'solid-icons/bs';
import {
  FormItem,
  Button,
  ComboBox,
  useToast,
  Timestamp,
} from '@castmill/ui-common';
import { ResourcesService } from '../services/resources.service';
import { AddonStore } from '../../common/interfaces/addon-store';

import './widget-config.scss';
import { WidgetView } from './widget-view';

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
  | 'select';

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

  // Fetch ancestor playlist IDs to prevent circular references
  createEffect(async () => {
    try {
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/playlists/${props.playlistId}/ancestors`,
        { credentials: 'include' }
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

  const optionsSchema = props.item.widget.options_schema || {};

  if (!optionsSchema) {
    return <div>No configuration available</div>;
  }

  const copyOptions = (options: Record<string, any>) => {
    return JSON.parse(JSON.stringify(options));
  };

  const setDefaultOptions = (options: Record<string, any>) => {
    const entries = Object.entries(optionsSchema);
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

  const checkFormValidity = () => {
    const entries = Object.entries(optionsSchema);
    const options = widgetOptions();
    for (const [key, schema] of entries) {
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

  function isValidURL(url: string): boolean {
    const urlPattern = new RegExp(
      '^((https?|ftp):\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$',
      'i' // fragment locator
    );
    return !!urlPattern.test(url);
  }

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
  ): string | number | boolean | object => {
    const options = widgetOptions();
    return options[key] || schema.default || '';
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

  createEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [isFormModified, widgetOptions]);

  function componentForItem(
    key: string,
    schema:
      | FieldAttributes
      | ReferenceAttributes
      | SimpleType
      | ComplexFieldAttributes
  ) {
    const type = getType(schema);
    switch (type) {
      case 'text':
      case 'number':
      case 'boolean':
      case 'color':
      case 'url':
        /* placeholder={schema?.placeholder} */
        return (
          <FormItem
            label={key}
            id={key}
            type={type}
            value={getValue(key, schema as FieldAttributes)}
            description={(schema as FieldAttributes).description}
            onInput={(value: string | number | boolean) => {
              if (validateField(type, schema as FieldAttributes, key, value)) {
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
              <label for={key}>{key}</label>
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
              <div class="description">{enumSchema.description}</div>
            </Show>
          </div>
        );
      case 'ref':
        const collection = (schema as ReferenceAttributes).collection;

        // Parse collection string (e.g., "medias|type:image" or "medias|type:video")
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

        // Determine media type for placeholder text
        const placeholderText =
          filters['type'] === 'image'
            ? t('common.selectImage')
            : filters['type'] === 'video'
              ? t('common.selectVideo')
              : t('common.selectMedia');

        switch (collectionName) {
          case 'medias':
            return (
              <>
                <ComboBox<JsonMedia>
                  id={key}
                  label={key}
                  placeholder={placeholderText}
                  value={getValue(key, schema as FieldAttributes)}
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
                  label={key}
                  placeholder={t('common.selectPlaylist')}
                  value={getValue(key, schema as FieldAttributes)}
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
                  onSelect={(playlist: JsonPlaylist) => {
                    setWidgetOptions({ ...widgetOptions(), [key]: playlist });
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
            <span>Created on </span>{' '}
            <Timestamp value={props.item.inserted_at} mode="relative" />.{' '}
            <span>Last updated on </span>
            <Timestamp value={props.item.updated_at} mode="relative" />
          </div>
        </Show>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isFormValid()) {
              // For references we need to pick the ID, not the full expanded object
              const options = Object.entries(optionsSchema).reduce(
                (acc: Record<string, any>, [key, schema]) => {
                  const type = getType(schema);
                  if (type === 'ref') {
                    acc[key] = widgetOptions()[key]?.id;
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
              } catch (err) {
                toast.error(`Error submitting form ${(err as Error).message}`);
              }

              setIsFormModified(false);
            }
          }}
        >
          <div class="form-inputs">
            <For each={Object.entries(optionsSchema)}>
              {([key, schema]) => {
                return componentForItem(key, schema);
              }}
            </For>
          </div>
          <div class="form-actions">
            <Button
              label="Update"
              type="submit"
              disabled={!isFormValid()}
              icon={BsCheckLg}
              color="success"
            />
            <Button
              label="Reset"
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
