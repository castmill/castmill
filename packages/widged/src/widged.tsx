/**
 * Widget Editor (c) 2024 Castmill™. All rights reserved.
 *
 */

import { FileContentProvider } from './file-context-provider';
import { FileReaderComponent } from './file-reader';

import styles from './widged.module.scss';
import { WidgetView } from './widget-view';

export const Widged = () => {
  return (
    <div class={styles['widged']}>
      <FileContentProvider>
        <div class={styles['header']}>
          <h1>Widget Editor</h1>
          <FileReaderComponent />
        </div>

        <div class={styles['content']}>
          <div class={styles['left']}>Left Sidebar</div>
          <div class={styles['center']}>
            <WidgetView />
          </div>
          <div class={styles['right']}>Right Sidebar</div>
        </div>

        <div class={styles['footer']}>
          <p>(c) 2024 Castmill™. All rights reserved.</p>
        </div>
      </FileContentProvider>
    </div>
  );
};
