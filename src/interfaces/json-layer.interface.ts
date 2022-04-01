import { JsonTransition } from "../transitions";
import { JsonWidget } from "./";

export interface JsonLayer {
  name: string;
  duration: number;
  slack: number;
  widget: JsonWidget;
  transition?: JsonTransition;
  css?: Partial<CSSStyleDeclaration>;
}
