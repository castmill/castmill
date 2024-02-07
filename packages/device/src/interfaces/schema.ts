/**
 * Represents a schema for a document.
 *
 */
type SimpleType = 'string' | 'number' | 'boolean'
type ComplexType = 'map' | 'list'

interface FieldAttributes {
  type: SimpleType
  required?: boolean
  default?: string | number
}

interface ReferenceAttributes {
  type: 'ref'
  required?: boolean
  collection: string
}

interface ComplexFieldAttributes {
  type: ComplexType
  schema: Schema
  required?: boolean
  default?: any
}

export type Schema = {
  [fieldName: string]:
    | SimpleType
    | FieldAttributes
    | ComplexFieldAttributes
    | ReferenceAttributes
}
