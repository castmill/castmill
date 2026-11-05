import {
  isOrientation,
  type Machine,
  type Orientation,
  type OrientationResult,
} from '../interfaces/machine';

export class OrientationManager {
  private orientation: Orientation = 0;
  private result: OrientationResult = { mode: 'css' };
  private applied = false;
  private operation: Promise<void> = Promise.resolve();
  private stage?: HTMLElement;
  private previousOverflow = '';
  private wrapper?: HTMLDivElement;
  private observer?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setInterval>;

  constructor(
    private machine: Machine,
    private onResize?: () => void
  ) {}

  async ready(): Promise<void> {
    await this.operation;
  }

  async restore(): Promise<void> {
    const stored = await this.machine.getSetting('ORIENTATION');
    if (stored === null) return;
    const angle = Number(stored);
    if (!/^(0|90|180|270)$/.test(stored) || !isOrientation(angle)) {
      throw new Error('Invalid stored device orientation');
    }
    await this.apply(angle);
  }

  apply(orientation: Orientation): Promise<OrientationResult> {
    if (!isOrientation(orientation)) {
      return Promise.reject(new Error('Invalid device orientation'));
    }
    const pending = this.operation.then(async () => {
      if (this.applied && this.orientation === orientation) return this.result;
      const result = this.machine.setOrientation
        ? await this.machine.setOrientation(orientation)
        : { mode: 'css' as const };
      if (result.mode !== 'css' && result.mode !== 'native') {
        throw new Error('Invalid native orientation result');
      }
      this.applied = false;
      this.orientation = orientation;
      this.result = result;
      this.update();
      await this.machine.setSetting('ORIENTATION', String(orientation));
      this.applied = true;
      return result;
    });
    // Keep the queue usable after a rejected operation without hiding its error
    // from the caller.
    this.operation = pending.then(
      () => undefined,
      () => undefined
    );
    return pending;
  }

  attach(stage: HTMLElement): HTMLElement {
    if (this.stage) this.dispose();
    this.previousOverflow = stage.style.overflow;
    stage.style.overflow = 'hidden';
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;left:50%;top:50%;transform-origin:50% 50%;';
    stage.appendChild(wrapper);
    const element = document.createElement('div');
    element.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;background:black;';
    wrapper.appendChild(element);
    this.stage = stage;
    this.wrapper = wrapper;
    this.update();
    window.addEventListener('resize', this.resize);
    document.addEventListener('fullscreenchange', this.resize);
    document.addEventListener('webkitfullscreenchange', this.resize);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(stage);
    } else {
      this.resizeTimer = setInterval(this.resize, 500);
    }
    return element;
  }

  private resize = () => this.update();

  private update(): void {
    if (!this.stage || !this.wrapper) return;
    const angle = this.result.mode === 'native' ? 0 : this.orientation;
    const { width, height } = this.stage.getBoundingClientRect();
    const swapped = angle === 90 || angle === 270;
    const nextWidth = `${swapped ? height : width}px`;
    const nextHeight = `${swapped ? width : height}px`;
    const changed =
      this.wrapper.style.width !== nextWidth ||
      this.wrapper.style.height !== nextHeight ||
      this.wrapper.dataset.castmillOrientation !== String(angle);
    this.wrapper.style.width = nextWidth;
    this.wrapper.style.height = nextHeight;
    this.wrapper.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    this.wrapper.dataset.castmillOrientation = String(angle);
    if (changed) {
      this.onResize?.();
      // Existing Chrome 38 text fitting listens for window resize.
      window.dispatchEvent(new Event('resize'));
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('fullscreenchange', this.resize);
    document.removeEventListener('webkitfullscreenchange', this.resize);
    this.observer?.disconnect();
    if (this.resizeTimer !== undefined) clearInterval(this.resizeTimer);
    if (this.stage && this.wrapper) {
      const element = this.wrapper.firstElementChild;
      if (element) this.stage.insertBefore(element, this.wrapper);
      this.wrapper.remove();
      this.stage.style.overflow = this.previousOverflow;
    }
    this.stage = undefined;
    this.wrapper = undefined;
  }
}
