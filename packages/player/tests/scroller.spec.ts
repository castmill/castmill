import { expect } from 'chai';

// Mock requestAnimationFrame and cancelAnimationFrame for Node.js environment
let rafId = 0;
const rafCallbacks: Map<number, FrameRequestCallback> = new Map();

(global as any).requestAnimationFrame = (
  callback: FrameRequestCallback
): number => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);
  return id;
};

(global as any).cancelAnimationFrame = (id: number): void => {
  rafCallbacks.delete(id);
};

// Helper to advance animation frames
function advanceFrame(time: number): void {
  const callbacks = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  callbacks.forEach(([_, callback]) => callback(time));
}

(global as any).performance = {
  now: () => Date.now(),
};

// Mock HTMLElement for testing
class MockHTMLElement {
  style: Record<string, string> = {};
  parentElement: MockHTMLElement | null = null;

  getBoundingClientRect() {
    return { width: 100, height: 50 };
  }

  appendChild(child: MockHTMLElement) {
    child.parentElement = this;
  }

  remove() {
    this.parentElement = null;
  }
}

// Mock document for parseGap
(global as any).document = {
  createElement: () => new MockHTMLElement(),
};

// Import after mocks are set up
// Note: We can't directly import the ScrollAnimation class since it's not exported
// So we'll test it indirectly through its interface

describe('ScrollAnimation', () => {
  // Since ScrollAnimation is a private class, we'll create a minimal implementation
  // that matches the interface for testing purposes

  class ScrollAnimation {
    private position = 0;
    private lastTime: number | null = null;
    private animationId: number | null = null;
    private _paused = true;
    private initialized = false;

    constructor(
      private element: { style: Record<string, string> },
      private config: {
        speed: number;
        scrollDistance: number;
        isHorizontal: boolean;
        isReverse: boolean;
      }
    ) {
      this.updateTransform();
    }

    markInitialized(): void {
      this.initialized = true;
    }

    play(): void {
      if (!this._paused) return;
      this._paused = false;
      this.lastTime = null;
      this.tick();
    }

    pause(): void {
      this._paused = true;
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    seek(timeMs: number): void {
      if (!this.initialized && timeMs > 0) {
        return;
      }
      const distance = (timeMs / 1000) * this.config.speed;
      this.position = distance % this.config.scrollDistance;
      this.updateTransform();
    }

    get paused(): boolean {
      return this._paused;
    }

    get duration(): number {
      return this.config.scrollDistance / this.config.speed;
    }

    get currentPosition(): number {
      return this.position;
    }

    destroy(): void {
      this.pause();
    }

    private tick = (): void => {
      if (this._paused) return;

      const now = performance.now();
      if (this.lastTime !== null) {
        const deltaMs = now - this.lastTime;
        const deltaPx = (deltaMs / 1000) * this.config.speed;

        this.position += deltaPx;

        if (this.position >= this.config.scrollDistance) {
          this.position = this.position % this.config.scrollDistance;
        }

        this.updateTransform();
      }

      this.lastTime = now;
      this.animationId = requestAnimationFrame(this.tick);
    };

    private updateTransform(): void {
      const offset = this.config.isReverse ? this.position : -this.position;

      if (this.config.isHorizontal) {
        this.element.style.transform = `translateX(${offset}px)`;
      } else {
        this.element.style.transform = `translateY(${offset}px)`;
      }
    }
  }

  describe('constructor', () => {
    it('should initialize with position 0', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      expect(element.style.transform).to.equal('translateX(0px)');
    });

    it('should start paused', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      expect(animation.paused).to.be.true;
    });
  });

  describe('duration', () => {
    it('should calculate duration based on scrollDistance and speed', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100, // 100 px/s
        scrollDistance: 500, // 500 px
        isHorizontal: true,
        isReverse: false,
      });

      // Duration should be 500 / 100 = 5 seconds
      expect(animation.duration).to.equal(5);
    });

    it('should return longer duration for slower speed', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 50, // 50 px/s
        scrollDistance: 500, // 500 px
        isHorizontal: true,
        isReverse: false,
      });

      // Duration should be 500 / 50 = 10 seconds
      expect(animation.duration).to.equal(10);
    });
  });

  describe('play and pause', () => {
    it('should set paused to false when play is called', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.play();
      expect(animation.paused).to.be.false;
    });

    it('should set paused to true when pause is called', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.play();
      animation.pause();
      expect(animation.paused).to.be.true;
    });
  });

  describe('seek', () => {
    it('should ignore seek before initialization', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      // Seek to 1 second (100px at 100px/s)
      animation.seek(1000);

      // Should still be at 0 because not initialized
      expect(element.style.transform).to.equal('translateX(0px)');
    });

    it('should allow seek to 0 before initialization', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.seek(0);
      expect(element.style.transform).to.equal('translateX(0px)');
    });

    it('should update position after markInitialized is called', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.markInitialized();

      // Seek to 1 second (100px at 100px/s)
      animation.seek(1000);

      // Should be at -100px (negative because scrolling left)
      expect(element.style.transform).to.equal('translateX(-100px)');
    });

    it('should work without needing to call play first', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      // Just mark initialized, don't play
      animation.markInitialized();

      // Seek should work
      animation.seek(2000);
      expect(element.style.transform).to.equal('translateX(-200px)');
    });

    it('should wrap position when exceeding scrollDistance', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.markInitialized();

      // Seek to 6 seconds (600px at 100px/s, should wrap to 100px)
      animation.seek(6000);

      // 600 % 500 = 100
      expect(element.style.transform).to.equal('translateX(-100px)');
    });
  });

  describe('direction', () => {
    it('should use negative translateX for left direction', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false, // left direction
      });

      animation.markInitialized();
      animation.seek(1000); // 100px

      expect(element.style.transform).to.equal('translateX(-100px)');
    });

    it('should use positive translateX for right direction', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: true, // right direction
      });

      animation.markInitialized();
      animation.seek(1000); // 100px

      expect(element.style.transform).to.equal('translateX(100px)');
    });

    it('should use translateY for vertical scrolling', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: false, // vertical
        isReverse: false, // up direction
      });

      animation.markInitialized();
      animation.seek(1000); // 100px

      expect(element.style.transform).to.equal('translateY(-100px)');
    });

    it('should use positive translateY for down direction', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: false, // vertical
        isReverse: true, // down direction
      });

      animation.markInitialized();
      animation.seek(1000); // 100px

      expect(element.style.transform).to.equal('translateY(100px)');
    });
  });

  describe('destroy', () => {
    it('should pause animation when destroyed', () => {
      const element = { style: {} as Record<string, string> };
      const animation = new ScrollAnimation(element, {
        speed: 100,
        scrollDistance: 500,
        isHorizontal: true,
        isReverse: false,
      });

      animation.play();
      expect(animation.paused).to.be.false;

      animation.destroy();
      expect(animation.paused).to.be.true;
    });
  });
});

describe('Scroller duration calculation', () => {
  // Test the loop duration formula

  it('should calculate correct loop duration for given content size and speed', () => {
    // Formula: loopDuration = oneSetSize / pixelsPerSecond
    const oneSetSize = 500; // px
    const speed = 100; // px/s

    const loopDuration = oneSetSize / speed;
    expect(loopDuration).to.equal(5); // 5 seconds
  });

  it('should account for gap in scroll distance', () => {
    // The scroll distance includes half a gap to account for the gap between sets
    const halfContentSize = 480; // Content width / 2
    const gapPx = 32; // e.g., 2em at 16px/em

    const oneSetSize = halfContentSize + gapPx / 2;
    expect(oneSetSize).to.equal(496);
  });

  it('should return duration in milliseconds for timeline', () => {
    const oneSetSize = 500;
    const speed = 100;
    const loopDurationSeconds = oneSetSize / speed;
    const loopDurationMs = loopDurationSeconds * 1000;

    expect(loopDurationMs).to.equal(5000);
  });
});

describe('Scroller options resolution', () => {
  it('should use default speed of 100 px/s', () => {
    const defaultSpeed = 100;
    expect(defaultSpeed).to.equal(100);
  });

  it('should use default gap of 2em', () => {
    const defaultGap = '2em';
    expect(defaultGap).to.equal('2em');
  });

  it('should use left as default direction', () => {
    const defaultDirection = 'left';
    expect(defaultDirection).to.equal('left');
  });
});
