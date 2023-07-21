import { JsonTransition } from "../transitions";
import { TemplateWidgetOptions } from "../widgets/template/template-widget";

export interface JsonLayer {
  name: string;
  duration?: number;
  slack: number;
  widget: TemplateWidgetOptions;
  transition?: JsonTransition;
  css?: Partial<CSSStyleDeclaration>;
}
