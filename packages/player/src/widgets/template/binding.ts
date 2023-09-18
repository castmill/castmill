import { Model } from "./data/model";

export interface Binding<T extends any> {
  key: string;
  default?: T;
}

export interface TemplateConfig<Options = any, Data = any> {
  options: Options;
  data: Data;
}

export const isBinding = (value: any) => typeof value === "object" && value.key;

export const resolveKey = (
  key: string,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
) => {
  if (key.startsWith("$.")) {
    // Resolve context path removing the "$." prefix
    return Model.get(context, key.substring(2), globals);
  }
  return Model.get(config, key, globals);
};

export const resolveBinding = (
  binding: Binding<any>,
  config: TemplateConfig,
  currentContext: any,
  globals: { [index: string]: any }
) => {
  const result = resolveKey(binding.key, config, currentContext, globals);

  if (typeof result == "undefined" || result[1] != null) {
    return binding.default;
  }
  return result[0];
};

export const resolveOption = (
  option: any,
  config: TemplateConfig,
  context: any,
  globals: { [index: string]: any }
) =>
  isBinding(option) ? resolveBinding(option, config, context, globals) : option;
