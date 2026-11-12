import {
  Component,
  createMemo,
  JSX,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js';
// The encoder core only; the package's renderers aren't needed.
import { create as createQRCode } from 'qrcode/lib/core/qrcode';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface QRCodeComponentOptions {
  /**
   * The content to encode in the QR code (typically a URL)
   */
  content: string;
  /**
   * Color of the QR code modules (dark squares)
   */
  foregroundColor?: string;
  /**
   * Background color of the QR code
   */
  backgroundColor?: string;
  /**
   * Error correction level: L (7%), M (15%), Q (25%), H (30%)
   */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /**
   * Duration the component is displayed (in milliseconds)
   */
  duration?: number;
}

export class QRCodeComponent implements TemplateComponent {
  readonly type = TemplateComponentType.QRCode;

  constructor(
    public name: string,
    public opts: QRCodeComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(_medias: { [index: string]: string }): number {
    return this.opts.duration || 10000;
  }

  static fromJSON(json: any): QRCodeComponent {
    return new QRCodeComponent(
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
  ): QRCodeComponentOptions {
    return {
      content: resolveOption(opts.content, config, context, globals),
      foregroundColor: resolveOption(
        opts.foregroundColor,
        config,
        context,
        globals
      ),
      backgroundColor: resolveOption(
        opts.backgroundColor,
        config,
        context,
        globals
      ),
      errorCorrectionLevel: resolveOption(
        opts.errorCorrectionLevel,
        config,
        context,
        globals
      ),
      duration: resolveOption(opts.duration, config, context, globals),
    };
  }
}

interface QRCodeProps extends BaseComponentProps {
  opts: QRCodeComponentOptions;
}

const ERROR_CORRECTION_LEVELS = ['L', 'M', 'Q', 'H'];

export interface QRCodeModules {
  size: number;
  /** SVG path covering every dark module, in module units. */
  path: string;
}

/**
 * Encodes `content` (as UTF-8) and returns the dark modules as one SVG path,
 * so a code stays one element however many modules it has.
 */
export function generateQRModules(
  content: string,
  errorCorrectionLevel?: string
): QRCodeModules {
  const level =
    errorCorrectionLevel &&
    ERROR_CORRECTION_LEVELS.indexOf(errorCorrectionLevel) !== -1
      ? errorCorrectionLevel
      : 'M';
  const { modules } = createQRCode(content, {
    errorCorrectionLevel: level,
  });
  const size = modules.size;
  let path = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!modules.get(y, x)) {
        x++;
        continue;
      }
      // Merge each horizontal run of dark modules into one rectangle.
      const start = x;
      while (x < size && modules.get(y, x)) x++;
      path +=
        'M' + start + ' ' + y + 'h' + (x - start) + 'v1h' + (start - x) + 'z';
    }
  }
  return { size, path };
}

export const QRCode: Component<QRCodeProps> = (props: QRCodeProps) => {
  let containerRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;

  const hasValidContent = createMemo(
    () => !!props.opts.content && props.opts.content.trim() !== ''
  );
  const qr = createMemo((): QRCodeModules | undefined => {
    const content = props.opts.content;
    if (!content || content.trim() === '') return undefined;
    try {
      return generateQRModules(content, props.opts.errorCorrectionLevel);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      return undefined;
    }
  });
  const gridSize = () => qr()?.size ?? 0;
  const foregroundColor = () => props.opts.foregroundColor ?? '#000000';
  const backgroundColor = () => props.opts.backgroundColor ?? '#ffffff';

  const merged = createMemo(() =>
    mergeProps(
      {
        width: '100%',
        height: '100%',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
      },
      props.style
    )
  );

  onCleanup(() => {
    cleanUpAnimations?.();
  });

  onMount(() => {
    if (containerRef && props.animations) {
      cleanUpAnimations = applyAnimations(
        props.timeline,
        props.animations,
        containerRef,
        props.timeline.duration()
      );
    }
    props.onReady();
  });

  return (
    <div
      ref={containerRef}
      data-component="qr-code"
      data-name={props.name}
      style={merged()}
    >
      {hasValidContent() && qr() && (
        <svg
          style={{
            width: '100%',
            height: '100%',
            'max-width': '100%',
            'max-height': '100%',
          }}
          viewBox={`0 0 ${gridSize()} ${gridSize()}`}
          preserveAspectRatio="xMidYMid meet"
          shape-rendering="crispEdges"
        >
          <rect
            width={gridSize()}
            height={gridSize()}
            fill={backgroundColor()}
          />
          <path d={qr()!.path} fill={foregroundColor()} />
        </svg>
      )}
    </div>
  );
};
