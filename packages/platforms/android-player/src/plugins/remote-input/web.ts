import { WebPlugin } from '@capacitor/core';
import type {
  RemoteInputPlugin,
  RemoteDimensions,
  DeviceDimensions,
  TapOptions,
  LongPressOptions,
  SwipeOptions,
  MultiStepGestureOptions,
  MappingInfo,
  ServiceStatus,
} from './definitions';

/**
 * Web implementation of RemoteInput plugin (stub for development)
 */
export class RemoteInputWeb extends WebPlugin implements RemoteInputPlugin {
  private remoteDimensions: RemoteDimensions = { width: 1920, height: 1080 };
  private deviceDimensions: DeviceDimensions = { width: 1920, height: 1080 };

  async setRemoteDimensions(options: RemoteDimensions): Promise<RemoteDimensions> {
    console.log('RemoteInput.setRemoteDimensions (web stub)', options);
    this.remoteDimensions = options;
    return options;
  }

  async getDeviceDimensions(): Promise<DeviceDimensions> {
    console.log('RemoteInput.getDeviceDimensions (web stub)');
    this.deviceDimensions = {
      width: window.screen.width,
      height: window.screen.height,
    };
    return this.deviceDimensions;
  }

  async getDisplayRotation(): Promise<{ rotation: number }> {
    console.log('RemoteInput.getDisplayRotation (web stub)');
    // Approximate rotation from screen orientation
    const orientation = window.screen.orientation?.type || 'portrait-primary';
    let rotation = 0;
    if (orientation.includes('landscape-primary')) rotation = 1;
    else if (orientation.includes('portrait-secondary')) rotation = 2;
    else if (orientation.includes('landscape-secondary')) rotation = 3;
    return { rotation };
  }

  async executeTap(options: TapOptions): Promise<void> {
    console.log('RemoteInput.executeTap (web stub)', options);
    // Simulate tap with a mouse event
    const event = new MouseEvent('click', {
      clientX: options.x,
      clientY: options.y,
      bubbles: true,
    });
    document.elementFromPoint(options.x, options.y)?.dispatchEvent(event);
  }

  async executeLongPress(options: LongPressOptions): Promise<void> {
    console.log('RemoteInput.executeLongPress (web stub)', options);
    // Simulate long press with contextmenu event
    const event = new MouseEvent('contextmenu', {
      clientX: options.x,
      clientY: options.y,
      bubbles: true,
    });
    document.elementFromPoint(options.x, options.y)?.dispatchEvent(event);
  }

  async executeSwipe(options: SwipeOptions): Promise<void> {
    console.log('RemoteInput.executeSwipe (web stub)', options);
    // Log swipe action (no real implementation on web)
    console.log(
      `Swipe from (${options.x1}, ${options.y1}) to (${options.x2}, ${options.y2}) over ${options.duration || 300}ms`
    );
  }

  async executeMultiStepGesture(options: MultiStepGestureOptions): Promise<void> {
    console.log('RemoteInput.executeMultiStepGesture (web stub)', options);
    // Log multi-step gesture action
    console.log(`Multi-step gesture with ${options.points.length} points over ${options.duration || 500}ms`);
  }

  async isServiceRunning(): Promise<ServiceStatus> {
    console.log('RemoteInput.isServiceRunning (web stub)');
    // Always return false on web
    return { isRunning: false };
  }

  async getMappingInfo(): Promise<MappingInfo> {
    console.log('RemoteInput.getMappingInfo (web stub)');
    const deviceDims = await this.getDeviceDimensions();
    
    // Calculate simple mapping info
    const scaleX = deviceDims.width / this.remoteDimensions.width;
    const scaleY = deviceDims.height / this.remoteDimensions.height;

    return {
      deviceWidth: deviceDims.width,
      deviceHeight: deviceDims.height,
      offsetX: 0,
      offsetY: 0,
      scaleX,
      scaleY,
    };
  }
}
