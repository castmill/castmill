import { JSX } from 'solid-js';
import { gsap } from 'gsap';
import { of } from 'rxjs';

import { TimelineWidget } from './timeline-widget';
import { applyCss } from '../utils';
import { ResourceManager } from '@castmill/cache';

const limits = {
  max: 100,
  min: 0,
};

const AnimationPresets = {
  snake: {
    from: {
      duration: 0.5,
      opacity: 0,
      scale: 0,
      y: 80,
      rotationX: 180,
      transformOrigin: '0% 50% -50',
      ease: 'back',
      stagger: 0.05,
    },
    perspective: 400,
    chars: true,
  },
  upper: {
    from: {
      duration: 0.8,
      opacity: 0,
      scale: 0,
      y: 80,
      rotationX: 180,
      transformOrigin: '0% 50% -50',
      ease: 'back',
      stagger: 0.01,
    },
    perspective: 400,
    chars: false,
  },
};

export class TextWidget extends TimelineWidget {
  static animationPresets = AnimationPresets;

  private div: HTMLElement;
  private text: string;
  private style: JSX.CSSProperties;
  private font?: {
    url: string;
    name: string;
  };

  private fontFace?: FontFace;

  constructor(
    resourceManager: ResourceManager,
    opts: {
      text: string;
      style: JSX.CSSProperties;
      font?: { url: string; name: string };
      animation?: {
        from: gsap.TweenVars;
        perspective?: number;
        chars?: boolean;
      };
    }
  ) {
    super(resourceManager, opts);
    this.text = opts.text;
    this.style = opts.style;
    this.font = opts.font;

    const div = (this.div = this.div = document.createElement('div'));
    div.textContent = this.text;
    applyCss(div, this.style);

    const tl = gsap.timeline({ paused: true });
    const tlItem = {
      start: this.timeline.duration(),
      child: tl,
    };
    this.timeline.add(tlItem);

    if (opts.animation) {
      const splittedText = splitText(div, opts.animation.chars);

      if (opts.animation.perspective) {
        gsap.set(div, { perspective: opts.animation.perspective });
      }
      tl.from(splittedText.chars || splittedText.words, opts.animation.from);
    }
  }

  show(el: HTMLElement, offset: number) {
    this.offset = offset;

    if (this.div?.parentElement) {
      return of('loaded');
    }

    el.appendChild(this.div);

    if (this.font) {
      this.fontFace = new FontFace(this.font.name, `url(${this.font.url})`);
      // add font to document
      (<any>document.fonts)['add'](this.fontFace);
    }

    // TODO: Improve autofit text
    // this.autoFitText();

    return of('loaded');
  }

  unload(): void {
    if (this.div) {
      this.div.parentElement?.removeChild(this.div);
    }

    if (this.fontFace) {
      (<any>document.fonts).delete(this.fontFace);
    }
  }

  mimeType(): string {
    return 'text';
  }

  autoFitText(options?: { min: number; max: number }) {
    if (this.div && this.div.textContent) {
      const textElement = this.div; // this.getInnerTextElement();
      let size = 1;
      const setSize = function (size: number) {
        textElement['style']['fontSize'] = size + 'em';
      };
      setSize(size);
      const containerRect = this.div.getBoundingClientRect();
      // Get scaled value of borders
      const scaleX = containerRect.width / this.div.offsetWidth;
      const scaleY = containerRect.height / this.div.offsetHeight;
      const padding =
        parseInt(`${gsap.getProperty(this.div, 'padding', 'px')}`) || 0;
      const borderWidth =
        parseInt(`${gsap.getProperty(this.div, 'border-width', 'px')}`) || 0;
      const borderX = padding * 1.99 * scaleX + borderWidth * 1.99 * scaleX;
      const borderY = padding * 1.99 * scaleY + borderWidth * 1.99 * scaleY;

      let l = (options && options.min) || limits.min;
      let r = (options && options.max) || limits.max;
      while (l <= r) {
        let m = (l + r) / 2;
        setSize(m);
        const textElementRect = textElement.getBoundingClientRect();
        if (
          containerRect.height - borderY >= textElementRect.height &&
          containerRect.width - borderX >= textElementRect.width
        ) {
          l = m + 0.01;
          size = m;
        } else {
          r = m - 0.01;
        }
      }
      setSize(size);
    }
  }
}

function createElementFromHTML(htmlString: string) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return Array.prototype.slice.call(div.children);
}

function splitText(div: HTMLDivElement, splitChars?: boolean) {
  if (splitChars) {
    const chars: HTMLDivElement[] = [];
    const words = div.innerHTML
      .split(' ')
      .map((word, index, arr) =>
        splitInChars(word, chars, index === arr.length - 1)
      );

    div.replaceChildren(...words);

    return { words, chars };
  } else {
    const wordsHTML = div.innerHTML
      .split(' ')
      .map(
        (word) =>
          `<div style="display: inline-block; text-align: start; position: relative;">${word}</div>`
      )
      .join(
        `<div style="display: inline-block; text-align: start; position: relative;">&nbsp;</div>`
      );

    const words = createElementFromHTML(wordsHTML);

    div.replaceChildren(...words);

    return { words };
  }
}

function splitInChars(
  word: string,
  charArray: HTMLDivElement[],
  isLast: boolean
) {
  const div = document.createElement('div');
  div.style.display = 'inline-block';
  div.style.textAlign = 'start';
  div.style.position = 'relative';

  const charElements = createElementFromHTML(
    word
      .split('')
      .map(
        (char) =>
          `<div style="display: inline-block; text-align: start; position: relative;">${char}</div>`
      )
      .join('')
  );

  if (!isLast) {
    const space = document.createElement('div');
    space.style.display = 'inline-block';
    space.style.textAlign = 'start';
    space.style.position = 'relative';
    space.innerHTML = '&nbsp;';
    charElements.push(space);
  }

  div.replaceChildren(...charElements);

  charArray.push.apply(charArray, charElements);

  return div;
}
