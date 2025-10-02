import { Component } from 'solid-js';
import { JsonWidget } from '@castmill/player';
import { AddonStore } from '../../common/interfaces/addon-store';

interface WidgetDetailsProps {
  widget: JsonWidget;
  store: AddonStore;
  onClose: () => void;
}

export const WidgetDetails: Component<WidgetDetailsProps> = (props) => {
  const formatJson = (obj: any) => {
    if (!obj) return 'null';
    return JSON.stringify(obj, null, 2);
  };

  const widget = props.widget;

  return (
    <div class="widget-details">
      <div class="widget-header">
        <div class="widget-icon">
          {widget.icon || '📦'}
        </div>
        <div class="widget-info">
          <h2>{widget.name}</h2>
          {widget.description && (
            <p class="description">{widget.description}</p>
          )}
        </div>
      </div>

      <div class="widget-sections">
        <div class="section template-section">
          <div class="section-title">Template</div>
          <div class="section-content">
            {widget.template?.type && (
              <div class="template-type">{widget.template.type}</div>
            )}
            <div class="json-code">
              {formatJson(widget.template)}
            </div>
          </div>
        </div>

        {(widget.options_schema || widget.data_schema) && (
          <div class="section schema-section">
            <div class="section-title">Schema</div>
            <div class="section-content">
              <div class="schema-grid">
                {widget.options_schema && (
                  <div class="schema-box">
                    <div class="schema-label">Options Schema</div>
                    <div class="json-code">
                      {formatJson(widget.options_schema)}
                    </div>
                  </div>
                )}
                {widget.data_schema && (
                  <div class="schema-box">
                    <div class="schema-label">Data Schema</div>
                    <div class="json-code">
                      {formatJson(widget.data_schema)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div class="section meta-section">
          <div class="section-title">Metadata</div>
          <div class="section-content">
            <div class="meta-grid">
              {widget.id && (
                <div class="meta-item">
                  <span class="meta-label">ID</span>
                  <span class="meta-value">{widget.id}</span>
                </div>
              )}
              {widget.update_interval_seconds && (
                <div class="meta-item">
                  <span class="meta-label">Update Interval</span>
                  <span class="meta-value">{widget.update_interval_seconds}s</span>
                </div>
              )}
              {widget.small_icon && (
                <div class="meta-item">
                  <span class="meta-label">Small Icon</span>
                  <span class="meta-value">{widget.small_icon}</span>
                </div>
              )}
              {widget.meta && (
                <div class="meta-item" style="grid-column: 1 / -1;">
                  <span class="meta-label">Additional Meta</span>
                  <div class="json-code" style="margin-top: 8px;">
                    {formatJson(widget.meta)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};