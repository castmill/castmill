import React, { useState, useMemo } from 'react';
import WidgetPreview from '../WidgetPreview';
import CodeBlock from '@theme/CodeBlock';
import styles from './styles.module.css';

interface WidgetExampleProps {
  widget: any; // JsonWidget
  data?: Record<string, any>;
  options?: Record<string, any>;
  height?: string;
  title?: string;
  description?: string;
  showControls?: boolean;
}

export default function WidgetExample({
  title,
  description,
  widget,
  data,
  options,
  height = '400px',
  showControls = true,
}: WidgetExampleProps): React.JSX.Element {
  const [mainTab, setMainTab] = useState<'code' | 'preview'>('preview');
  const [codeTab, setCodeTab] = useState<'widget' | 'data' | 'options'>('widget');

  // Serialize the template immediately on mount, before any mutations
  const widgetJSON = useMemo(() => {
    try {
      // Serialize only the template property to avoid any wrapper metadata
      const template = widget.template || widget;
      return JSON.stringify(template, null, 2);
    } catch (error) {
      return `// Error serializing widget: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }, [widget]);

  // Create a deep clone of the widget for the preview to prevent mutations
  const widgetForPreview = useMemo(() => {
    try {
      // Deep clone to prevent the player from mutating the original
      const template = widget.template || widget;
      return {
        ...widget,
        template: JSON.parse(JSON.stringify(template))
      };
    } catch (error) {
      // If cloning fails, pass the original (better than nothing)
      return widget;
    }
  }, [widget]);
  
  const dataJSON = data && Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : null;
  const optionsJSON = options && Object.keys(options).length > 0 ? JSON.stringify(options, null, 2) : null;

  return (
    <div className={styles.widgetExample}>
      {(title || description) && (
        <div className={styles.header}>
          {title && <h4 className={styles.title}>{title}</h4>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
      )}

      {/* Main Tabs: Code vs Preview */}
      <div className={styles.mainTabs}>
        <button
          onClick={() => setMainTab('preview')}
          className={`${styles.mainTab} ${mainTab === 'preview' ? styles.activeMainTab : ''}`}
        >
          Preview
        </button>
        <button
          onClick={() => setMainTab('code')}
          className={`${styles.mainTab} ${mainTab === 'code' ? styles.activeMainTab : ''}`}
        >
          Code
        </button>
      </div>

      <div className={styles.content}>
        {mainTab === 'preview' && (
          <div className={styles.previewSection}>
            <WidgetPreview
              widget={widgetForPreview}
              data={data}
              options={options}
              height={height}
              showControls={showControls}
            />
          </div>
        )}

        {mainTab === 'code' && (
          <div className={styles.codeSection}>
            {/* Code Sub-Tabs: Widget / Data / Options */}
            <div className={styles.codeTabs}>
              <button
                onClick={() => setCodeTab('widget')}
                className={`${styles.codeTabBtn} ${codeTab === 'widget' ? styles.activeCodeTab : ''}`}
              >
                Widget
              </button>
              {dataJSON && (
                <button
                  onClick={() => setCodeTab('data')}
                  className={`${styles.codeTabBtn} ${codeTab === 'data' ? styles.activeCodeTab : ''}`}
                >
                  Data
                </button>
              )}
              {optionsJSON && (
                <button
                  onClick={() => setCodeTab('options')}
                  className={`${styles.codeTabBtn} ${codeTab === 'options' ? styles.activeCodeTab : ''}`}
                >
                  Options
                </button>
              )}
            </div>

            <div className={styles.codeContent}>
              {codeTab === 'widget' && (
                <CodeBlock language="json" title="widget.json">
                  {widgetJSON}
                </CodeBlock>
              )}
              {codeTab === 'data' && dataJSON && (
                <CodeBlock language="json" title="data.json">
                  {dataJSON}
                </CodeBlock>
              )}
              {codeTab === 'options' && optionsJSON && (
                <CodeBlock language="json" title="options.json">
                  {optionsJSON}
                </CodeBlock>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
