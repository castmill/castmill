import { Model } from "./data/model";

export interface Binding<T extends any> {
  key: string;
  default?: T;
}

export interface TemplateConfig {
  options: any; // ImageComponentOptions | etc,
  data: any;
}

export const isBinding = (value: any) => typeof value === "object" && value.key;

export const resolveBinding = (
  binding: Binding<any>,
  config: TemplateConfig,
  currentContext: any
) => {
  let value;
  if (binding.key.startsWith(".")) {
    // Resolve relative path removing the first dot.
    value = Model.get(currentContext, binding.key.substring(1));
  } else {
    value = Model.get(config, binding.key);
  }

  if (typeof value == "undefined") {
    return [binding.default, null];
  }
};

export const resolveOption = (
  option: any,
  config: TemplateConfig,
  context: any
) => (isBinding(option) ? resolveBinding(option, config, context) : option);
