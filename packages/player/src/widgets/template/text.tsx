import { Component, JSX, mergeProps, onMount } from "solid-js";
import { TemplateConfig, resolveOption } from "./binding";
import { Observable, of } from "rxjs";
import { TemplateComponent, TemplateComponentType } from "./template";

interface AutoFitOpts {
  maxSize?: number;
  maxLines?: number;
}

export interface TextComponentOptions {
  text: string;
  autofit: AutoFitOpts;
}

export class TextComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Text;

  constructor(
    public name: string,
    public opts: TextComponentOptions,
    public style: JSX.CSSProperties,
  ) {}

  resolveDuration(): number {
    return 0;
  }

  static fromJSON(json: any): TextComponent {
    return new TextComponent(json.name, json.opts, json.style);
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any
  ): TextComponentOptions {
    return {
      text: resolveOption(opts.url, config, context),
      autofit: {
        maxSize: resolveOption(opts.size, config, context),
        maxLines: resolveOption(opts.size, config, context),
      },
    };
  }
}

// TODO: We must support formatters and templates. For example:
export interface formatter {
  fn: string;
  args: (string | number)[];
}

export type pipeline = formatter[];

// pipeline: [{fn: "formatNumber", args: ["$val"]}, {fn: "format", args: ["$val SEK"]}]

// Initial formatters must include the most important ones, such as formating numbers suitable for prices and quantities.

// TODO: rename text to value (all components that need a value should have value as prop)

export const Text: Component<{
  name?: string;
  opts: TextComponentOptions;
  style: JSX.CSSProperties;
  onReady: () => void;
}> = (props) => {
  let textRef: HTMLDivElement | undefined;

  const merged = mergeProps(
    { width: "100%", height: "100%", "line-height": "1em" },
    props.style
  );

  const spanStyle = {
    "line-height": merged["line-height"],
  };

  onMount(() => {
    if (!textRef) {
      return;
    }
    autoFitText(textRef, props.opts?.autofit);
    props.onReady();
  });

  return (
    <div data-component="text" data-name={props.name} style={merged}>
      <span ref={textRef} style={spanStyle}>
        {props.opts.text}
      </span>
    </div>
  );
};

const limits = {
  max: 10,
};

const maxNumIterations = 10;
const tolerance = 0.001;

function autoFitText(div: HTMLDivElement, options?: AutoFitOpts) {
  if (div && div.textContent) {
    const textElement = div;

    const setSize = function (size: number) {
      textElement.style.fontSize = `${size}em`;
      textElement.style.overflowWrap = "normal";
    };

    const parentElement = div.parentElement!;

    //
    // Set max lines limits
    // Note: in order for this to work,
    // line-height must be set to some value using em units. ex line-height: 1em;
    //
    if (options?.maxLines) {
      const lineHeight = parseInt(textElement.style.lineHeight) || 1;
      parentElement.style.maxHeight = `${options.maxLines * lineHeight}em`;
    }

    const containerRect = parentElement.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      return;
    }

    let l = 0;
    let r = (options && options.maxSize) || limits.max;

    const maxHeight = Math.ceil(containerRect.height);
    const maxWidth = Math.ceil(containerRect.width);

    let count = 0;
    let lastWidth = 0,
      lastHeight = 0;
    while (
      (r - l > tolerance && count < maxNumIterations) ||
      lastHeight > maxHeight ||
      lastWidth > maxWidth
    ) {
      count++;
      const size = (l + r) / 2;

      setSize(size);
      const { height, width } = textElement.getBoundingClientRect();

      // Do not allow text to become smaller than 8px
      if (height <= 8 || width <= 8) {
        break;
      }

      lastHeight = height;
      lastWidth = width;

      if (height <= maxHeight && width <= maxWidth) {
        // Make the text larger
        l = size;
      } else {
        // Make the text smaller
        r = size;
      }
    }
  }
}
