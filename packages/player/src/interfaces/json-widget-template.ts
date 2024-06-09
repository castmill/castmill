import { JSX } from "solid-js/jsx-runtime";
import { TemplateComponentType } from "..";
import { ComponentAnimation } from "../widgets/template/animation";

export interface JsonWidgetTemplate {
  type: TemplateComponentType;
  name: string;
  opts: any;
  style?: JSX.CSSProperties;
  animations?: ComponentAnimation[];
}
