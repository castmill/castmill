import { render, createComponent } from 'solid-js/web';
import App from './App';
import { Device } from './classes';

export * from './classes';
export * from './interfaces';
export * from './integrations';

export const mountDevice = (root: HTMLElement, device: Device) => {
  render(() => createComponent(App, { device }), root);
};
