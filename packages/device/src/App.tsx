import type { Component } from 'solid-js';
import { Device } from './classes/device';

import logo from './logo.svg';
import styles from './App.module.css';
import { DeviceComponent } from './components/device.component';
import { MenuComponent } from './components/menu.component';

const App: Component<{ device: Device }> = (props: { device: Device }) => {
  return (
    <div class={styles.App}>
      <MenuComponent />
      <DeviceComponent device={props.device} />
    </div>
  );
};

export default App;
