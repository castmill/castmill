import { Component, For, createEffect, createSignal, Show } from 'solid-js';
import {
  JsonPlaylistItem,
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
import { FormItem, Button, ComboBox } from '@castmill/ui-common';

import { ResourcesService } from '../services/resources.service';

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
  baseUrl: string;
  item: JsonPlaylistItem;
  organizationId: string;
  onSubmit: (value: {
    config: Partial<JsonWidgetConfig>;
    expandedOptions: OptionsDict;
  }) => Promise<void>;
}

type FormTypes = 'text' | 'number' | 'boolean' | 'ref' | 'color' | 'url';

export const WidgetConfig: Component<WidgetConfigProps> = (props) => {
  const [widgetConfig, setWidgetConfig] = createSignal(props.item.config);
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [isFormValid, setIsFormValid] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  console.log('WidgetConfig', props.item, props.organizationId);
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

  const getType = (value: any): FormTypes => {
    return value.type || value;
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
      case 'ref':
        // Only images supported for now
        const collection = (schema as ReferenceAttributes).collection;
        switch (collection) {
          case 'medias|type:image':
            return (
              <>
                <ComboBox<JsonMedia>
                  id={key}
                  label={key}
                  placeholder={'Select an Image'}
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
                      'medias',
                      {
                        page,
                        page_size: pageSize,
                        search,
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
          default:
            throw new Error(`Unknown collection: ${collection}`);
        }
      case 'map':
      case 'list':
        return <div>Not implemented yet</div>;
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
            <span>{`${props.item.inserted_at}`}. </span>
            <span>Last updated on </span>
            <span>{`${props.item.updated_at}`}</span>
          </div>
        </Show>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isFormValid()) {
              // For references we need to pick the ID, not the full expanded object
              const options = Object.entries(optionsSchema).reduce(
                (acc: Record<string, any>, [key, schema]) => {
                  if (getType(schema) === 'ref') {
                    acc[key] = widgetOptions()[key].id;
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
                alert(`Error submitting form ${(err as Error).message}`);
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
        <Show when={isFormValid()}>
          <WidgetView
            widget={props.item.widget}
            config={widgetConfig()}
            options={widgetOptions()}
          />
        </Show>
      </div>
    </div>
  );
};
