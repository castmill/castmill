import {
  Component,
  For,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  on,
  Show,
} from 'solid-js';
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
  ChoicesAttributes,
  ListFieldAttributes,
} from '@castmill/player';
import { BsCheckLg, BsPlusLg } from 'solid-icons/bs';
import {
  FormItem,
  Button,
  ComboBox,
  useToast,
  Timestamp,
  LocationPicker,
  ChoicesField,
  ChoicesFieldLabels,
  ConfirmDialog,
} from '@castmill/ui-common';
import { ResourcesService } from '../services/resources.service';
import {
  PlaylistsService,
  WidgetChoicesError,
} from '../services/playlists.service';
import { AddonStore } from '../../common/interfaces/addon-store';
import { getTranslatedWidgetOption } from '../../common/utils/widget-catalog-utils';

import './widget-config.scss';
import { WidgetView } from './widget-view';
import { EditableTextStage, EditableTextLabels } from './editable-text-stage';
import {
  TextOverridesList,
  TextOverridesListLabels,
} from './text-overrides-list';
import {
  TextOverride,
  describeOverrides,
  getOverrides,
  setOverride,
  shouldShowTextOverrides,
  supportsTextOverrides,
  templateEditables,
  translateEditableLabel,
} from './text-overrides';
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
  /** Shows a Cancel button; the parent decides whether to confirm discarding. */
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export const resolvePlaybackLocale = (defaultLocale?: string) =>
  defaultLocale || 'en';

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
  | 'list'
  | 'choices';

export type SchemaAttributeType =
  | SimpleType
  | FieldAttributes
  | ComplexFieldAttributes
  | ReferenceAttributes
  | LayoutFieldAttributes
  | LayoutRefFieldAttributes
  | LocationFieldAttributes
  | ListFieldAttributes;

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

export const isLocationValueValid = (
  value: LocationValue | null | undefined
): boolean => {
  if (!value) return false;
  if (typeof value.lat !== 'number' || Number.isNaN(value.lat)) return false;
  if (typeof value.lng !== 'number' || Number.isNaN(value.lng)) return false;
  if (value.lat < -90 || value.lat > 90) return false;
  if (value.lng < -180 || value.lng > 180) return false;
  return true;
};

export const normalizeFormValue = (
  value: unknown
): string | number | boolean => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return '';
};

export const normalizeWidgetOptionsForApi = (
  options: OptionsDict,
  schemaEntries: [string, SchemaAttributeType][]
): Record<string, any> => {
  const normalized = normalizeSchemaOptions(options, schemaEntries);
  // Edited texts are stored in the reserved `overrides` option, which is not
  // part of the options schema.
  if (
    options.overrides !== undefined &&
    !schemaEntries.some(([key]) => key === 'overrides')
  ) {
    normalized.overrides = options.overrides;
  }
  return normalized;
};

export const normalizeWidgetOptionsForIntegration = (
  options: OptionsDict,
  schemaEntries: [string, SchemaAttributeType][],
  textOverridesReserved: boolean
): Record<string, any> => {
  const normalized = normalizeWidgetOptionsForApi(options, schemaEntries);
  if (textOverridesReserved) delete normalized.overrides;
  return normalized;
};

const normalizeSchemaOptions = (
  options: OptionsDict,
  schemaEntries: [string, SchemaAttributeType][]
): Record<string, any> =>
  schemaEntries.reduce(
    (normalizedOptions, [key, schema]) => {
      const value = options[key];
      const type =
        typeof schema === 'string'
          ? schema
          : 'enum' in schema
            ? 'select'
            : schema.type;

      if (type === 'ref') {
        normalizedOptions[key] =
          value && typeof value === 'object'
            ? (value as { id?: unknown }).id
            : value;
        return normalizedOptions;
      }

      if (type === 'layout-ref' && value && typeof value === 'object') {
        const layoutRef = value as LayoutRefValue;
        normalizedOptions[key] = {
          ...layoutRef,
          zonePlaylistMap: Object.fromEntries(
            // Older saves may store raw IDs or string IDs instead of objects.
            Object.entries(
              (layoutRef.zonePlaylistMap || {}) as Record<string, unknown>
            ).map(([zoneId, assignment]) => [
              zoneId,
              {
                playlistId:
                  typeof assignment === 'number'
                    ? assignment
                    : typeof assignment === 'string' &&
                        /^-?\d+$/.test(assignment.trim())
                      ? Number.parseInt(assignment, 10)
                      : typeof assignment === 'object' &&
                          assignment !== null &&
                          'playlistId' in assignment &&
                          typeof assignment.playlistId === 'number'
                        ? assignment.playlistId
                        : typeof assignment === 'object' &&
                            assignment !== null &&
                            'playlistId' in assignment &&
                            typeof assignment.playlistId === 'string' &&
                            /^-?\d+$/.test(assignment.playlistId.trim())
                          ? Number.parseInt(assignment.playlistId, 10)
                          : undefined,
              },
            ])
          ),
        };
        return normalizedOptions;
      }

      normalizedOptions[key] = value;
      return normalizedOptions;
    },
    {} as Record<string, any>
  );

/**
 * Returns the `choices` attribute of a schema field, if it takes its values
 * from an integration-provided list.
 */
export const getFieldChoices = (
  schema: unknown
): ChoicesAttributes | undefined => {
  const choices =
    schema && typeof schema === 'object'
      ? (schema as { choices?: ChoicesAttributes }).choices
      : undefined;
  return choices && typeof choices.list === 'string' ? choices : undefined;
};

const isEmptyOption = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * Splits a choice field's dependencies into the values to send to the
 * provider and the dependencies that are still missing.
 */
export const choiceDependencies = (
  choices: ChoicesAttributes,
  options: Record<string, unknown>
): { values: Record<string, unknown>; missing: string[] } => {
  const values: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const key of choices.depends_on || []) {
    if (isEmptyOption(options[key])) {
      missing.push(key);
    } else {
      values[key] = options[key];
    }
  }
  return { values, missing };
};

/**
 * Keys of choice fields that depend directly or transitively on `key` and have a value.
 */
export const dependentChoiceFields = (
  entries: [string, SchemaAttributeType][],
  key: string,
  options: Record<string, unknown>
): string[] => {
  const dependents = new Map<string, string[]>();
  for (const [fieldKey, schema] of entries) {
    for (const dependency of getFieldChoices(schema)?.depends_on || []) {
      const fields = dependents.get(dependency) || [];
      fields.push(fieldKey);
      dependents.set(dependency, fields);
    }
  }

  const pending = [key];
  const visited = new Set([key]);
  const selected = new Set<string>();

  for (let cursor = 0; cursor < pending.length; cursor++) {
    const dependency = pending[cursor];
    for (const fieldKey of dependents.get(dependency) || []) {
      if (visited.has(fieldKey)) continue;
      visited.add(fieldKey);
      pending.push(fieldKey);
      if (!isEmptyOption(options[fieldKey])) selected.add(fieldKey);
    }
  }

  return entries
    .map(([fieldKey]) => fieldKey)
    .filter((fieldKey) => selected.has(fieldKey));
};

/**
 * Validates a choice field value. Returns an error message, or '' when valid.
 */
export const validateChoicesValue = (
  choices: ChoicesAttributes,
  required: boolean | undefined,
  value: unknown,
  t: (key: string, params?: Record<string, any>) => string
): string => {
  const values = Array.isArray(value)
    ? value
    : isEmptyOption(value)
      ? []
      : [value];

  if (required && values.length === 0) {
    return t('validation.fieldRequired');
  }
  if (choices.multiple && typeof choices.min === 'number') {
    if (values.length < choices.min) {
      return t('widgets.choices.minSelection', { min: choices.min });
    }
  }
  if (choices.multiple && typeof choices.max === 'number') {
    if (values.length > choices.max) {
      return t('widgets.choices.maxSelection', { max: choices.max });
    }
  }
  return '';
};

const CHOICES_ERROR_KEYS: Record<string, string> = {
  widget_not_found: 'widgetNotFound',
  not_a_choice_field: 'notAChoiceField',
  missing_dependency: 'missingDependency',
  missing_credentials: 'missingCredentials',
  rate_limited: 'rateLimited',
  provider_error: 'providerError',
  network_error: 'networkError',
};

/**
 * Localized message for an error from the widget choices endpoint.
 */
export const choicesErrorMessage = (
  error: unknown,
  t: (key: string, params?: Record<string, any>) => string
): string => {
  const code = error instanceof WidgetChoicesError ? error.code : '';
  return t(`widgets.choices.errors.${CHOICES_ERROR_KEYS[code] || 'unknown'}`);
};

/**
 * Labels for the ChoicesField component.
 */
export const choicesFieldLabels = (
  t: (key: string, params?: Record<string, any>) => string
): ChoicesFieldLabels => ({
  choose: t('widgets.choices.choose'),
  change: t('common.change'),
  add: t('common.add'),
  clear: t('common.clear'),
  remove: t('common.remove'),
  moveBefore: t('widgets.choices.moveBefore'),
  moveAfter: t('widgets.choices.moveAfter'),
  search: t('widgets.choices.search'),
  loadMore: t('widgets.choices.loadMore'),
  retry: t('widgets.choices.retry'),
  noResults: t('widgets.choices.noResults'),
  noSelection: t('widgets.choices.noSelection'),
  unavailable: t('widgets.choices.unavailable'),
  selectAll: t('widgets.choices.selectAll'),
  selectNone: t('widgets.choices.selectNone'),
  selected: (count, max) =>
    typeof max === 'number'
      ? t('widgets.choices.selectedCountMax', { count, max })
      : t('widgets.choices.selectedCount', { count }),
  done: t('widgets.choices.done'),
  cancel: t('common.cancel'),
  play: t('widgets.choices.play'),
  stop: t('widgets.choices.stop'),
  enlarge: t('widgets.choices.enlarge'),
  close: t('common.close'),
  dialogDescription: t('widgets.choices.dialogDescription'),
});

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
  // Items that are not yet in the playlist are added rather than saved.
  const isNewItem = () => props.item.id === undefined || props.item.id === null;
  createEffect(() => props.onDirtyChange?.(isFormModified()));
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
  const displayLocale = () =>
    resolvePlaybackLocale(props.store.networkSettings?.defaultLocale);

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
  const textOverridesEnabled = supportsTextOverrides(props.item.widget);
  const showTextOverrides = shouldShowTextOverrides(
    props.item.widget,
    props.item.config.options
  );

  if ((!rawOptionsSchema || schemaEntries.length === 0) && !showTextOverrides) {
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

  // Integration data shown in the live preview. Unlike the playlist item view,
  // the preview must reflect the options currently being edited (e.g. toggling
  // the temperature unit on the Weather widget) before they are saved. We fetch
  // it via the prefetch endpoint, which computes the data from the supplied
  // options rather than the previously persisted ones.
  const [previewData, setPreviewData] = createSignal<Record<
    string,
    any
  > | null>(null);
  const [previewDiscriminatorId, setPreviewDiscriminatorId] = createSignal<
    string | null
  >(null);

  let previewFetchTimer: ReturnType<typeof setTimeout> | undefined;
  // Monotonic id used to discard responses from superseded requests, so that a
  // slow request cannot overwrite the preview of a newer one.
  let previewRequestId = 0;

  const previewFetchInput = createMemo(() => {
    const currentOptions = widgetOptions();
    const options = normalizeWidgetOptionsForIntegration(
      currentOptions,
      schemaEntries,
      showTextOverrides
    );
    return JSON.stringify({
      options,
      displayLocale: displayLocale(),
      widgetId: props.item.widget?.id,
      widgetConfigId: props.item.config.id,
      baseUrl: props.baseUrl,
      organizationId: props.organizationId,
    });
  });

  createEffect(
    on(previewFetchInput, (serialized) => {
      const {
        options: fetchOptions,
        displayLocale: locale,
        widgetId,
        widgetConfigId,
        baseUrl,
        organizationId,
      } = JSON.parse(serialized);
      const options = { ...fetchOptions, display_locale: locale };
      setPreviewDiscriminatorId(null);

      if (!widgetId || !baseUrl || !organizationId) {
        return;
      }

      // Debounce to avoid hammering the integration endpoint while the user is
      // still editing (e.g. typing into text fields).
      if (previewFetchTimer) {
        clearTimeout(previewFetchTimer);
      }

      const requestId = ++previewRequestId;
      previewFetchTimer = setTimeout(async () => {
        const result = await PlaylistsService.prefetchWidgetData(
          baseUrl,
          organizationId,
          widgetId,
          options,
          // Live preview fetches are ephemeral: they must not register background
          // polling schedulers for option combinations that may never be saved.
          { preview: true, widgetConfigId }
        );

        // Ignore out-of-order responses from superseded requests.
        if (requestId !== previewRequestId) {
          return;
        }

        setPreviewDiscriminatorId(result.discriminator_id ?? null);
        setPreviewData(result && result.data ? result.data : null);
      }, 500);
    })
  );

  onCleanup(() => {
    if (previewFetchTimer) {
      clearTimeout(previewFetchTimer);
    }
    // Discard any in-flight response once the component goes away.
    previewRequestId++;
  });

  /**
   * Gets the form type for a schema entry.
   */
  const getFormType = (schema: any): FormTypes => {
    if (getFieldChoices(schema)) {
      return 'choices';
    }
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

      if (fieldType === 'location') {
        const locationValue = options[key] as LocationValue | null | undefined;
        if (!isLocationValueValid(locationValue)) {
          return false;
        }
      }

      if (fieldType === 'choices') {
        const message = validateChoicesValue(
          getFieldChoices(schema)!,
          (schema as FieldAttributes).required,
          options[key],
          t
        );
        if (message) {
          return false;
        }
        continue;
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
    schema: FieldAttributes | SimpleType | LocationFieldAttributes,
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
      case 'choices':
        break;
      case 'location':
        if (!isLocationValueValid(value as LocationValue | null | undefined)) {
          errorMessage = t('validation.invalidCoordinates');
        }
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
    if (getFieldChoices(value)) {
      return 'choices';
    }
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

  // A change of a choice field that other choice fields depend on waits for
  // confirmation, because it clears their values.
  const [pendingChoice, setPendingChoice] = createSignal<{
    key: string;
    value: string | string[] | undefined;
    dependents: string[];
  } | null>(null);

  const applyChoice = (
    key: string,
    value: string | string[] | undefined,
    clear: string[]
  ) => {
    const next: OptionsDict = { ...widgetOptions(), [key]: value as any };
    const errorUpdates = new Map(errors());

    for (const fieldKey of [key, ...clear]) {
      const fieldSchema = schemaEntries.find(([k]) => k === fieldKey)?.[1];
      const choices = getFieldChoices(fieldSchema);
      if (!choices) continue;
      if (fieldKey !== key) {
        if (choices.multiple) {
          next[fieldKey] = [] as any;
        } else {
          delete next[fieldKey];
        }
      }
      errorUpdates.set(
        fieldKey,
        validateChoicesValue(
          choices,
          (fieldSchema as FieldAttributes).required,
          next[fieldKey],
          t
        )
      );
    }

    if (value === undefined) {
      delete next[key];
    }

    setWidgetOptions(next);
    setErrors(errorUpdates);
    setIsFormModified(true);
  };

  const changeChoice = (key: string, value: string | string[] | undefined) => {
    const dependents = dependentChoiceFields(
      schemaEntries,
      key,
      widgetOptions()
    );
    const changed =
      JSON.stringify(widgetOptions()[key] ?? null) !==
      JSON.stringify(value ?? null);

    if (dependents.length > 0 && changed) {
      setPendingChoice({ key, value, dependents });
    } else {
      applyChoice(key, value, []);
    }
  };

  const fieldLabels = (keys: string[]) =>
    keys.map((k) => translateWidgetOptionLabel(k, k)).join(', ');

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
      | ListFieldAttributes
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
            value={normalizeFormValue(formValue)}
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
                  closeLabel={t('common.close')}
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
                  closeLabel={t('common.close')}
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
              t={t}
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
                validateField('location', locationSchema, key, newValue);
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
              closeLabel={t('common.close')}
            />
            <div class="error">{errors().get(key)}</div>
          </div>
        );
      case 'choices': {
        const choicesSchema = schema as (
          | FieldAttributes
          | ListFieldAttributes
        ) & {
          title?: string;
          placeholder?: string;
        };
        const choices = getFieldChoices(schema)!;
        const dependencies = () =>
          choiceDependencies(
            choices,
            widgetOptions() as Record<string, unknown>
          );

        return (
          <div class="form-item-wrapper">
            <ChoicesField
              id={key}
              label={translateWidgetOptionLabel(
                key,
                choicesSchema.title || key
              )}
              description={translateWidgetOptionDescription(
                key,
                choicesSchema.description
              )}
              value={widgetOptions()[key] as string | string[] | undefined}
              multiple={!!choices.multiple}
              ordered={!!choices.ordered}
              min={choices.min}
              max={choices.max}
              display={choices.display}
              search={!!choices.search}
              required={!!choicesSchema.required}
              disabled={dependencies().missing.length > 0}
              disabledHint={t('widgets.choices.dependencyRequired', {
                fields: fieldLabels(dependencies().missing),
              })}
              emptyHint={translateWidgetOptionPlaceholder(
                key,
                choicesSchema.placeholder
              )}
              reloadKey={JSON.stringify(dependencies().values)}
              labels={choicesFieldLabels(t)}
              loadChoices={(request) =>
                PlaylistsService.listWidgetChoices(
                  props.baseUrl,
                  props.organizationId,
                  props.item.widget.id!,
                  key,
                  { ...request, options: dependencies().values }
                )
              }
              errorMessage={(error) => choicesErrorMessage(error, t)}
              onChange={(value) => changeChoice(key, value)}
            />
            <div class="error">{errors().get(key)}</div>
          </div>
        );
      }
      case 'map':
        return <div>Map type not implemented yet</div>;
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  // In-place text editing (see agents/systems/IN-PLACE-TEXT-EDITING.md)
  const [editingTexts, setEditingTexts] = createSignal(false);
  const [seenLabels, setSeenLabels] = createSignal(
    new Map<string, string | undefined>()
  );
  const editables = templateEditables(props.item.widget.template);
  const translateLabel = (label: string | undefined) =>
    translateEditableLabel(props.item.widget, label, locale());
  const overrides = () => getOverrides(widgetOptions());

  const updateOverrides = (next: Record<string, TextOverride>) => {
    setWidgetOptions({ ...widgetOptions(), overrides: next as any });
    setIsFormModified(true);
  };

  const changeTextOverride = (key: string, value: TextOverride | undefined) =>
    updateOverrides(setOverride(overrides(), key, value));

  const overrideEntries = () =>
    describeOverrides(overrides(), editables, seenLabels(), translateLabel);

  const editableTextLabels = (): EditableTextLabels => ({
    editAria: (label) => t('widgets.editableTexts.editAria', { label }),
    save: t('common.save'),
    cancel: t('common.cancel'),
    hide: t('widgets.editableTexts.hide'),
    reset: t('widgets.editableTexts.reset'),
    counter: (length, max) =>
      t('widgets.editableTexts.counter', { length, max }),
  });

  const textOverridesListLabels = (): TextOverridesListLabels => ({
    title: (count) => t('widgets.editableTexts.listTitle', { count }),
    hidden: t('widgets.editableTexts.hidden'),
    empty: t('widgets.editableTexts.empty'),
    reset: t('widgets.editableTexts.reset'),
    resetAll: t('widgets.editableTexts.resetAll'),
    unusedTitle: t('widgets.editableTexts.unusedTitle'),
    unusedHint: t('widgets.editableTexts.unusedHint'),
    remove: t('common.remove'),
  });

  return (
    <div class="widget-config-dialog">
      <div class="widget-config">
        <Show when={props.item.inserted_at}>
          <div class="widget-config-meta">
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
              const options = normalizeWidgetOptionsForApi(
                widgetOptions(),
                schemaEntries
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
            <Show when={showTextOverrides}>
              <TextOverridesList
                used={overrideEntries().used}
                unused={overrideEntries().unused}
                labels={textOverridesListLabels()}
                onReset={(key) => changeTextOverride(key, undefined)}
                onResetAll={() => updateOverrides({})}
              />
            </Show>
          </div>
          <ConfirmDialog
            show={!!pendingChoice()}
            title={t('widgets.choices.confirmClearTitle')}
            message={t('widgets.choices.confirmClearMessage', {
              field: fieldLabels(pendingChoice() ? [pendingChoice()!.key] : []),
              fields: fieldLabels(pendingChoice()?.dependents || []),
            })}
            confirmLabel={t('common.clear')}
            cancelLabel={t('common.cancel')}
            onConfirm={() => {
              const pending = pendingChoice();
              setPendingChoice(null);
              if (pending) {
                applyChoice(pending.key, pending.value, pending.dependents);
              }
            }}
            onClose={() => setPendingChoice(null)}
          />
          <footer class="form-actions">
            <span class="form-actions-dirty" aria-live="polite">
              {!isNewItem() && isFormModified()
                ? t('playlists.editor.unsavedChanges')
                : ''}
            </span>
            <Show when={props.onCancel}>
              <Button
                label={t('common.cancel')}
                onClick={() => props.onCancel?.()}
                color="secondary"
              />
            </Show>
            <Button
              label={
                isNewItem()
                  ? t('playlists.editor.addToPlaylist')
                  : t('common.save')
              }
              type="submit"
              // Saving an unchanged item would be a no-op, so require edits.
              disabled={!isFormValid() || (!isNewItem() && !isFormModified())}
              icon={isNewItem() ? BsPlusLg : BsCheckLg}
              color="success"
            />
          </footer>
        </form>
      </div>
      <section class="preview" aria-label={t('common.preview')}>
        <header class="preview-header" aria-hidden="true">
          <h3>{t('common.preview')}</h3>
        </header>
        <Show when={textOverridesEnabled}>
          <div class="preview-toolbar">
            <Button
              label={
                editingTexts()
                  ? t('widgets.editableTexts.doneEditing')
                  : t('widgets.editableTexts.editTexts')
              }
              color={editingTexts() ? 'success' : 'secondary'}
              aria-pressed={editingTexts()}
              onClick={() => setEditingTexts(!editingTexts())}
            />
            <Show when={editingTexts()}>
              <span>{t('widgets.editableTexts.hint')}</span>
            </Show>
          </div>
        </Show>
        <div class="preview-stage">
          <EditableTextStage
            active={editingTexts()}
            overrides={overrides()}
            labels={editableTextLabels()}
            translateLabel={translateLabel}
            onChange={changeTextOverride}
            onDiscover={setSeenLabels}
          >
            <WidgetView
              widget={props.item.widget}
              config={widgetConfig()}
              options={widgetOptions()}
              previewData={previewData()}
              locale={displayLocale()}
              previewDiscriminatorId={previewDiscriminatorId()}
              onPreviewDataUpdate={setPreviewData}
              baseUrl={props.baseUrl}
              socket={props.store.socket}
              paused={editingTexts()}
            />
          </EditableTextStage>
        </div>
      </section>
    </div>
  );
};
