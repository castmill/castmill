/**
 * Represents a schema for a document.
 *
 */
type SimpleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'url'
  | 'location';
type ComplexType = 'map' | 'list';

interface BaseAttributes {
  label?: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  default?: any;
}

interface FieldAttributes extends BaseAttributes {
  type: SimpleType;
  default?: string | number | boolean;
}

interface ReferenceAttributes extends BaseAttributes {
  type: 'ref';
  collection: string;
}

interface ComplexFieldAttributes extends BaseAttributes {
  type: ComplexType;
  schema: Schema;
  default?: any;
}

export type Schema = {
  [fieldName: string]:
    | SimpleType
    | FieldAttributes
    | ComplexFieldAttributes
    | ReferenceAttributes;
};
