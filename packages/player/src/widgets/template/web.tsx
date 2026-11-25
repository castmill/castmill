import { Component, createMemo, JSX, onCleanup, onMount, Show } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface WebComponentOptions {
  url?: string;
  duration?: number;
}

export class WebComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Web;

  constructor(
    public name: string,
    public opts: WebComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(_medias: { [index: string]: string }): number {
    return this.opts.duration || 10000;
  }

  static fromJSON(json: any): WebComponent {
    return new WebComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter
    );
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): WebComponentOptions {
    return {
      url: resolveOption(opts.url, config, context, globals),
      duration: resolveOption(opts.duration, config, context, globals),
    };
  }
}

interface WebProps extends BaseComponentProps {
  opts: WebComponentOptions;
  globals: PlayerGlobals;
}

const WebFrame: Component<WebProps & { url: string }> = (props) => {
  let frame: HTMLIFrameElement | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let disposeAnimations: (() => void) | undefined;
  let disposed = false;
  let ready = false;
  const loadBlock = {};

  const fail = (code: string, message: string) => {
    if (disposed) return;
    clearTimeout(timeout);
    const error = new Error(message);
    console.warn(message);
    props.globals.reportError?.({ category: 'media-load', code, error });
    props.globals.setPlaybackBlocked?.(loadBlock, {
      category: 'media-load',
      code,
      error,
    });
  };

  onMount(() => {
    if (!ready) {
      timeout = setTimeout(
        () =>
          fail('web-load-timeout', 'Web page did not load within 30 seconds'),
        30000
      );
    }
    if (frame && props.animations) {
      disposeAnimations = applyAnimations(
        props.timeline,
        props.animations,
        frame,
        props.timeline.duration()
      );
    }
  });

  onCleanup(() => {
    disposed = true;
    clearTimeout(timeout);
    disposeAnimations?.();
    props.globals.setPlaybackBlocked?.(loadBlock);
    if (frame) frame.src = 'about:blank';
  });

  return (
    <iframe
      ref={frame}
      data-component="web"
      data-name={props.name}
      title={props.name || 'Web widget'}
      src={props.url}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        border: '0',
        ...props.style,
      }}
      onLoad={() => {
        if (disposed) return;
        clearTimeout(timeout);
        props.globals.setPlaybackBlocked?.(loadBlock);
        if (!ready) {
          ready = true;
          props.onReady();
        }
      }}
      onError={() => fail('web-load-failed', 'Web page could not be loaded')}
    />
  );
};

const InvalidWebUrl: Component<WebProps> = (props) => {
  const loadBlock = {};
  const error = new Error('Web widget requires an absolute HTTP or HTTPS URL');
  onMount(() => {
    console.warn(error.message);
    props.globals.reportError?.({
      category: 'media-load',
      code: 'web-invalid-url',
      error,
    });
    props.globals.setPlaybackBlocked?.(loadBlock, {
      category: 'media-load',
      code: 'web-invalid-url',
      error,
    });
  });
  onCleanup(() => props.globals.setPlaybackBlocked?.(loadBlock));
  return (
    <div
      data-component="web"
      data-name={props.name}
      style={props.style}
      role="alert"
    >
      {error.message}
    </div>
  );
};

export const Web: Component<WebProps> = (props) => {
  const url = createMemo(() => {
    if (typeof props.opts.url !== 'string') return undefined;
    try {
      const parsed = new URL(props.opts.url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? parsed.href
        : undefined;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return undefined;
    }
  });
  return (
    <Show when={url()} keyed fallback={<InvalidWebUrl {...props} />}>
      {(source) => <WebFrame {...props} url={source} />}
    </Show>
  );
};
