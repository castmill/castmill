/**
 * Template Schema
 *
 * This class is used for defining the data schema to be used by the template widget.
 *
 */
type ValidTypes =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'array'
  | 'schema';

interface SchemaField<D extends ValidTypes, T> {
  type: D;
  required?: boolean;
  default: T;
}

export interface SchemaDefinition {
  [key: string]:
    | SchemaField<'string', string>
    | SchemaField<'number', number>
    | SchemaField<'boolean', boolean>
    | SchemaField<'date', string>
    | SchemaField<'time', string>
    | SchemaField<'datetime', string>
    | SchemaField<'array', SchemaDefinition[]>
    | SchemaField<'schema', SchemaDefinition>;
}

export interface SchemaError {
  key: string;
  message: string;
}

function checkField(
  type: string,
  value: any,
  key: string,
  errors: SchemaError[]
) {
  if (typeof value !== type) {
    errors.push({
      key,
      message: `Invalid type for field: ${key}. Expected ${type}, got ${typeof value}`,
    });
    return false;
  }
  return true;
}

export class Schema {
  constructor(private schema: SchemaDefinition) {}

  validate(data: any): SchemaError[] {
    const errors: SchemaError[] = [];
    const keys = Object.keys(this.schema);

    for (const key of keys) {
      const value = data[key];
      const type = this.schema[key];
      if (type.required && value === undefined) {
        errors.push({
          key: key,
          message: `Missing required field: ${key}`,
        });
      } else {
        switch (type.type) {
          case 'string':
            checkField('string', value, key, errors);
        }

        if (value !== undefined) {
          switch (type.type) {
            case 'string':
              checkField('string', value, key, errors);
              break;
            case 'number':
              checkField('number', value, key, errors);
              break;
            case 'boolean':
              checkField('boolean', value, key, errors);
              break;
            case 'date':
              if (checkField('string', value, key, errors)) {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                  errors.push({
                    key: key,
                    message: `Invalid date: ${value}`,
                  });
                }
              }
              break;
            case 'time':
              checkField('string', value, key, errors);
              const time = new Date(`1970-01-01T${value}`);
              if (isNaN(time.getTime())) {
                errors.push({
                  key: key,
                  message: `Invalid time for field: ${key}`,
                });
              }
              break;
            case 'datetime':
              checkField('string', value, key, errors);
              const datetime = new Date(value);
              if (isNaN(datetime.getTime())) {
                errors.push({
                  key: key,
                  message: `Invalid datetime for field: ${key}`,
                });
              }
              break;
            case 'array':
              if (checkField('object', value, key, errors)) {
                if (!Array.isArray(value)) {
                  errors.push({
                    key: key,
                    message: `Invalid type for field: ${key}. Expected array, got ${typeof value}`,
                  });
                }
              }
              break;
            case 'schema':
              if (checkField('object', value, key, errors)) {
                const schema = new Schema(type.default);
                for (const item of value) {
                  errors.push(...schema.validate(item));
                }
              }
              break;
          }
        }
      }
    }
    return errors;
  }
}
