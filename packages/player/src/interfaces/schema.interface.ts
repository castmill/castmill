/**
 * Represents a schema for a document.
 *
 */
export type SimpleType = 'string' | 'number' | 'boolean';
export type ComplexType = 'map' | 'list';

export interface FieldAttributes {
  type: SimpleType;
  required?: boolean;
  default?: string | number;
  description?: string;
  min?: number;
  max?: number;
}

export interface ReferenceAttributes {
  type: 'ref';
  required?: boolean;
  collection: string;
  description?: string;
}

export interface ComplexFieldAttributes {
  type: ComplexType;
  schema: Schema;
  required?: boolean;
  default?: any;
}

export type Schema = {
  [fieldName: string]:
  | SimpleType
  | FieldAttributes
  | ComplexFieldAttributes
  | ReferenceAttributes;
};
