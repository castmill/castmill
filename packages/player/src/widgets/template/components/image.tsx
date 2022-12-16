import { Component, JSX, mergeProps } from "solid-js";
import { TemplateComponent, TemplateComponentType } from "./group";

export class ImageComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Image;

  constructor(
    public name: string,
    public url: string,
    public style: JSX.CSSProperties,
    public binding?: string,
    public classes?: string
  ) {}
}

export const Image: Component<{
  name: string;
  url: string;
  style: JSX.CSSProperties;
  mediasMap: { [index: string]: string };
}> = (props) => {
  const merged = mergeProps(
    {
      width: "100%",
      height: "100%",
      "background-image": `url(${props.mediasMap[props.url]})`,
      "background-size": "cover", // "contain",
      "background-repeat": "no-repeat",
      "background-position": "center",
    },
    props.style
  );

  return (
    <div data-component="image" data-name={props.name} style={merged}></div>
  );
};
