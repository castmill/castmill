import { Component } from 'solid-js';
import {
  DetailsSummary,
  DetailsSummaryChip,
  DetailsSummaryPill,
  DetailsSummaryTone,
  TabItem,
  Tabs,
} from '@castmill/ui-common';
import { JsonWidget } from '@castmill/player';
import './widgets.scss';

type WidgetScope = 'system' | 'network' | 'organization' | 'unassigned';

const SCOPE_TONES: Record<WidgetScope, DetailsSummaryTone> = {
  system: 'neutral',
  network: 'info',
  organization: 'success',
  unassigned: 'warning',
};

export interface WidgetDetailsViewProps {
  widget: JsonWidget;
  description?: string;
  tabs: TabItem[];
  initialIndex?: number;
  t: (key: string, params?: Record<string, any>) => string;
  onCopyError?: (error: unknown) => void;
}

/**
 * Body of the widget details drawer: a summary card with the widget's
 * type, availability and update interval, followed by the detail tabs.
 */
export const WidgetDetailsView: Component<WidgetDetailsViewProps> = (props) => {
  const t = props.t;

  const scope = (): WidgetScope => {
    const value = props.widget.scope as WidgetScope | undefined;
    return value && value in SCOPE_TONES ? value : 'system';
  };

  const pills = (): DetailsSummaryPill[] => [
    {
      label: props.widget.template?.type || t('common.unknown'),
      tone: 'info',
      title: t('common.type'),
    },
    {
      label: t(`widgets.scope.${scope()}`),
      tone: SCOPE_TONES[scope()],
      title: t('widgets.scope.title'),
    },
  ];

  const chips = (): DetailsSummaryChip[] =>
    props.widget.update_interval_seconds
      ? [
          {
            label: t('widgets.details.updatesEvery', {
              seconds: props.widget.update_interval_seconds,
            }),
            title: t('widgets.updateInterval'),
          },
        ]
      : [];

  return (
    <div class="widget-details-content">
      <DetailsSummary
        class="widget-summary"
        label={t('widgets.widgetDetails')}
        pills={pills()}
        note={props.description}
        chips={chips()}
        copy={
          props.widget.slug
            ? {
                value: props.widget.slug,
                label: t('widgets.details.copySlug'),
                copiedMessage: t('widgets.details.slugCopied'),
                onError: props.onCopyError,
              }
            : undefined
        }
      />

      <Tabs
        tabs={props.tabs}
        initialIndex={props.initialIndex}
        ariaLabel={t('common.sections')}
      />
    </div>
  );
};

export default WidgetDetailsView;
