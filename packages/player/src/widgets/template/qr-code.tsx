import { Component, JSX, mergeProps, onCleanup, onMount, For } from 'solid-js';
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

/**
 * Generates a QR code matrix (2D array of booleans).
 * This is a simplified QR code implementation supporting byte mode.
 */
function generateQRMatrix(content: string): boolean[][] {
  // Use a compact QR code implementation
  const qr = new QRCodeGenerator(content);
  return qr.getMatrix();
}

// QR Code generator implementation
// Based on QR Code specification ISO/IEC 18004

const ErrorCorrectionLevel = {
  L: 0, // 7% recovery
  M: 1, // 15% recovery
  Q: 2, // 25% recovery
  H: 3, // 30% recovery
};

// Number of data codewords for each version and EC level
const DATA_CODEWORDS: number[][] = [
  // Version 1-10 (index 0-9), EC levels L, M, Q, H
  [19, 16, 13, 9],
  [34, 28, 22, 16],
  [55, 44, 34, 26],
  [80, 64, 48, 36],
  [108, 86, 62, 46],
  [136, 108, 76, 60],
  [156, 124, 88, 66],
  [194, 154, 110, 86],
  [232, 182, 132, 100],
  [274, 216, 154, 122],
];

// Format information for each EC level and mask pattern
const FORMAT_INFO: number[][] = [
  // L
  [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  // M
  [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  // Q
  [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
  // H
  [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
];

class QRCodeGenerator {
  private matrix: boolean[][];
  private size: number;
  private version: number;
  private ecLevel: number = ErrorCorrectionLevel.M;

  constructor(content: string) {
    // Encode data
    const data = this.encodeData(content);

    // Determine version based on data length
    this.version = this.getMinVersion(data.length);
    this.size = 17 + this.version * 4;

    // Initialize matrix
    this.matrix = Array(this.size)
      .fill(null)
      .map(() => Array(this.size).fill(false));

    // Build QR code
    this.addFinderPatterns();
    this.addAlignmentPatterns();
    this.addTimingPatterns();
    this.addDarkModule();
    this.reserveFormatArea();

    // Add data and error correction
    const codewords = this.addErrorCorrection(data);
    this.placeData(codewords);

    // Apply best mask
    const mask = this.applyBestMask();
    this.addFormatInfo(mask);
  }

  private encodeData(content: string): number[] {
    // Use byte mode (mode indicator = 0100)
    const data: number[] = [];

    // Mode indicator (4 bits): byte mode = 0100
    let buffer = 0b0100;
    let bufferLength = 4;

    // Character count indicator (8 bits for version 1-9, 16 for 10+)
    const countBits = this.version < 10 ? 8 : 16;
    buffer = (buffer << countBits) | content.length;
    bufferLength += countBits;

    // Add data bytes
    for (let i = 0; i < content.length; i++) {
      buffer = (buffer << 8) | content.charCodeAt(i);
      bufferLength += 8;

      while (bufferLength >= 8) {
        bufferLength -= 8;
        data.push((buffer >> bufferLength) & 0xff);
      }
    }

    // Add terminator
    const capacity = DATA_CODEWORDS[this.version - 1]?.[this.ecLevel] || 19;
    const terminatorBits = Math.min(4, (capacity - data.length) * 8);
    buffer = buffer << terminatorBits;
    bufferLength += terminatorBits;

    // Pad to byte boundary
    if (bufferLength > 0) {
      buffer = buffer << (8 - bufferLength);
      data.push(buffer & 0xff);
    }

    // Pad to capacity
    let padByte = 0xec;
    while (data.length < capacity) {
      data.push(padByte);
      padByte = padByte === 0xec ? 0x11 : 0xec;
    }

    return data;
  }

  private getMinVersion(dataLength: number): number {
    for (let v = 1; v <= 10; v++) {
      const capacity = DATA_CODEWORDS[v - 1]?.[this.ecLevel];
      if (capacity && dataLength <= capacity) {
        return v;
      }
    }
    return 10; // Max supported version
  }

  private addFinderPatterns(): void {
    const positions = [
      [0, 0],
      [0, this.size - 7],
      [this.size - 7, 0],
    ];

    for (const [row, col] of positions) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isOn =
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          this.matrix[row + r][col + c] = isOn;
        }
      }
    }

    // Add separators (white border around finder patterns)
    // Top-left
    for (let i = 0; i < 8; i++) {
      if (i < this.size) {
        this.matrix[7][i] = false;
        this.matrix[i][7] = false;
      }
    }
    // Top-right
    for (let i = 0; i < 8; i++) {
      if (this.size - 8 + i < this.size) {
        this.matrix[7][this.size - 8 + i] = false;
      }
      if (i < 8) {
        this.matrix[i][this.size - 8] = false;
      }
    }
    // Bottom-left
    for (let i = 0; i < 8; i++) {
      if (this.size - 8 + i < this.size) {
        this.matrix[this.size - 8 + i][7] = false;
      }
      if (i < 8) {
        this.matrix[this.size - 8][i] = false;
      }
    }
  }

  private addAlignmentPatterns(): void {
    if (this.version < 2) return;

    const positions = this.getAlignmentPositions();

    for (const row of positions) {
      for (const col of positions) {
        // Skip positions that overlap with finder patterns
        if (
          (row < 9 && col < 9) ||
          (row < 9 && col > this.size - 10) ||
          (row > this.size - 10 && col < 9)
        ) {
          continue;
        }

        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isOn =
              Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            this.matrix[row + r][col + c] = isOn;
          }
        }
      }
    }
  }

  private getAlignmentPositions(): number[] {
    if (this.version === 1) return [];

    const positions = [6];
    const step = Math.floor(
      (this.size - 13) / (Math.floor(this.version / 7) + 1)
    );
    let pos = this.size - 7;

    while (pos > 6) {
      positions.unshift(pos);
      pos -= step;
    }

    return positions;
  }

  private addTimingPatterns(): void {
    for (let i = 8; i < this.size - 8; i++) {
      const isOn = i % 2 === 0;
      this.matrix[6][i] = isOn;
      this.matrix[i][6] = isOn;
    }
  }

  private addDarkModule(): void {
    this.matrix[this.size - 8][8] = true;
  }

  private reserveFormatArea(): void {
    // Format info areas are reserved but will be filled in later
    // We don't need to do anything here as the matrix is initialized to false
  }

  private addErrorCorrection(data: number[]): number[] {
    // Simplified: just return data with some basic padding
    // A full implementation would add Reed-Solomon error correction codes
    const ecCodewords = this.getECCodewords();
    const result = [...data];

    // Generate error correction codewords using polynomial division
    const generator = this.getGeneratorPolynomial(ecCodewords);
    const msgPoly = [...data, ...Array(ecCodewords).fill(0)];

    for (let i = 0; i < data.length; i++) {
      const coef = msgPoly[i];
      if (coef !== 0) {
        for (let j = 0; j < generator.length; j++) {
          msgPoly[i + j] ^= this.gfMultiply(generator[j], coef);
        }
      }
    }

    // Append EC codewords
    result.push(...msgPoly.slice(data.length));

    return result;
  }

  private getECCodewords(): number {
    // EC codewords per block for version 1-10, EC level M
    const ecTable = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
    return ecTable[this.version - 1] || 10;
  }

  private getGeneratorPolynomial(degree: number): number[] {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const newPoly = Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        newPoly[j] ^= poly[j];
        newPoly[j + 1] ^= this.gfMultiply(poly[j], this.gfPow(2, i));
      }
      poly = newPoly;
    }
    return poly;
  }

  private gfPow(base: number, exp: number): number {
    let result = 1;
    for (let i = 0; i < exp; i++) {
      result = this.gfMultiply(result, base);
    }
    return result;
  }

  private gfMultiply(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    let result = 0;
    while (b > 0) {
      if (b & 1) result ^= a;
      a <<= 1;
      if (a & 0x100) a ^= 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
      b >>= 1;
    }
    return result;
  }

  private placeData(codewords: number[]): void {
    let index = 0;
    let upward = true;
    let col = this.size - 1;

    while (col > 0) {
      // Skip timing pattern column
      if (col === 6) col--;

      for (
        let row = upward ? this.size - 1 : 0;
        upward ? row >= 0 : row < this.size;
        row += upward ? -1 : 1
      ) {
        for (let c = 0; c < 2; c++) {
          const x = col - c;
          if (!this.isReserved(row, x)) {
            if (index < codewords.length * 8) {
              const bit =
                (codewords[Math.floor(index / 8)] >> (7 - (index % 8))) & 1;
              this.matrix[row][x] = bit === 1;
              index++;
            }
          }
        }
      }

      col -= 2;
      upward = !upward;
    }
  }

  private isReserved(row: number, col: number): boolean {
    // Finder patterns + separators
    if (row < 9 && col < 9) return true;
    if (row < 9 && col > this.size - 9) return true;
    if (row > this.size - 9 && col < 9) return true;

    // Timing patterns
    if (row === 6 || col === 6) return true;

    // Format info areas
    if (row === 8 && (col < 9 || col > this.size - 9)) return true;
    if (col === 8 && (row < 9 || row > this.size - 9)) return true;

    // Dark module
    if (row === this.size - 8 && col === 8) return true;

    // Alignment patterns (version 2+)
    if (this.version >= 2) {
      const positions = this.getAlignmentPositions();
      for (const pr of positions) {
        for (const pc of positions) {
          if (
            (pr < 9 && pc < 9) ||
            (pr < 9 && pc > this.size - 10) ||
            (pr > this.size - 10 && pc < 9)
          ) {
            continue;
          }
          if (
            row >= pr - 2 &&
            row <= pr + 2 &&
            col >= pc - 2 &&
            col <= pc + 2
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private applyBestMask(): number {
    // Apply mask 0 for simplicity (full implementation would test all 8)
    const mask = 0;
    this.applyMask(mask);
    return mask;
  }

  private applyMask(mask: number): void {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!this.isReserved(row, col)) {
          let shouldFlip = false;
          switch (mask) {
            case 0:
              shouldFlip = (row + col) % 2 === 0;
              break;
            case 1:
              shouldFlip = row % 2 === 0;
              break;
            case 2:
              shouldFlip = col % 3 === 0;
              break;
            case 3:
              shouldFlip = (row + col) % 3 === 0;
              break;
            case 4:
              shouldFlip =
                (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
              break;
            case 5:
              shouldFlip = ((row * col) % 2) + ((row * col) % 3) === 0;
              break;
            case 6:
              shouldFlip = (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
              break;
            case 7:
              shouldFlip = (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
              break;
          }
          if (shouldFlip) {
            this.matrix[row][col] = !this.matrix[row][col];
          }
        }
      }
    }
  }

  private addFormatInfo(mask: number): void {
    const formatBits = FORMAT_INFO[this.ecLevel][mask];

    // Place format info around top-left finder pattern
    for (let i = 0; i < 6; i++) {
      this.matrix[8][i] = ((formatBits >> i) & 1) === 1;
      this.matrix[i][8] = ((formatBits >> (14 - i)) & 1) === 1;
    }
    this.matrix[8][7] = ((formatBits >> 6) & 1) === 1;
    this.matrix[8][8] = ((formatBits >> 7) & 1) === 1;
    this.matrix[7][8] = ((formatBits >> 8) & 1) === 1;

    // Place format info on other sides
    for (let i = 0; i < 7; i++) {
      this.matrix[this.size - 1 - i][8] = ((formatBits >> i) & 1) === 1;
    }
    for (let i = 0; i < 8; i++) {
      this.matrix[8][this.size - 8 + i] = ((formatBits >> (14 - i)) & 1) === 1;
    }
  }

  getMatrix(): boolean[][] {
    return this.matrix;
  }
}

export const QRCode: Component<QRCodeProps> = (props: QRCodeProps) => {
  let containerRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;

  // Generate QR code matrix
  const content = props.opts.content;
  const hasValidContent = content && content.trim() !== '';

  let matrix: boolean[][] = [];
  let gridSize = 0;

  if (hasValidContent) {
    try {
      matrix = generateQRMatrix(content);
      gridSize = matrix.length;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  }

  const foregroundColor = props.opts.foregroundColor ?? '#000000';
  const backgroundColor = props.opts.backgroundColor ?? '#ffffff';

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
    },
    props.style
  );

  onCleanup(() => {
    cleanUpAnimations && cleanUpAnimations();
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

  // Render QR code using CSS Grid for resolution independence
  // Each module is sized using percentage of the grid container
  // Flatten the matrix manually for compatibility
  const flatMatrix: boolean[] = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      flatMatrix.push(matrix[y][x]);
    }
  }

  return (
    <div
      ref={containerRef}
      data-component="qr-code"
      data-name={props.name}
      style={merged}
    >
      {hasValidContent && gridSize > 0 && (
        <div
          style={{
            width: '100%',
            height: '100%',
            'max-width': '100%',
            'max-height': '100%',
            'aspect-ratio': '1 / 1',
            display: 'grid',
            'grid-template-columns': `repeat(${gridSize}, 1fr)`,
            'grid-template-rows': `repeat(${gridSize}, 1fr)`,
            'background-color': backgroundColor,
          }}
        >
          <For each={flatMatrix}>
            {(isOn) => (
              <div
                style={{
                  'background-color': isOn ? foregroundColor : backgroundColor,
                }}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
};
