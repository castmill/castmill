/**
 * Schema interface.
 * 
 * 
 */

type SimpleType = "string" | "number" | "boolean";
type ComplexType = "ref" | "map" | "list";
type FieldType = SimpleType | ComplexType;

interface FieldAttributes {
  type: FieldType;
  required?: boolean;
  default?: string | number;
}

interface ComplexFieldAttributes extends FieldAttributes {
  schema?: Schema;
  collection?: string;
}

export type Schema = {
  [fieldName: string]: SimpleType | FieldAttributes | ComplexFieldAttributes;
};
