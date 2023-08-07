import { Model } from "./data/model";

export interface Binding<T extends any> {
  key: string;
  default?: T;
}

export interface TemplateConfig<Options = any, Data = any> {
  options: Options; // ImageComponentOptions | etc,
  data: Data; // ImageComponentData | etc
}

export const isBinding = (value: any) => typeof value === "object" && value.key;

export const resolveKey = (
  key: string,
  config: TemplateConfig,
  context: any
) => {
  // Change to $.
  if (key.startsWith("$.")) {
    // Resolve context path removing the "$." prefix
    return Model.get(context, key.substring(2));
  } else {
    return Model.get(config, key);
  }
};

export const resolveBinding = (
  binding: Binding<any>,
  config: TemplateConfig,
  currentContext: any
) => {
  const result = resolveKey(binding.key, config, currentContext);

  if (typeof result == "undefined" || result[1] != null) {
    return binding.default;
  }
  return result[0];
};

export const resolveOption = (
  option: any,
  config: TemplateConfig,
  context: any
) => (isBinding(option) ? resolveBinding(option, config, context) : option);
