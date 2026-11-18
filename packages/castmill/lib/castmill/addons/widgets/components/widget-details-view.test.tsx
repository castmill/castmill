import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonWidget } from '@castmill/player';
import { WidgetDetailsView } from './widget-details-view';
import { JsonHighlight, JSON_COPY_FEEDBACK_MS } from './json-highlight';
import { AssetsList } from './assets-list';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const t = (key: string, params?: Record<string, any>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const widget = (overrides: Partial<JsonWidget> = {}): JsonWidget => ({
  id: 7,
  name: 'Clock',
  slug: 'clock',
  template: { type: 'group' } as JsonWidget['template'],
  update_interval_seconds: 60,
  scope: 'organization',
  ...overrides,
});

const tabs = [
  { title: 'Template', content: () => <p>Template panel</p> },
  { title: 'Assets', content: () => <p>Assets panel</p> },
];

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WidgetDetailsView', () => {
  it('renders the metadata as a summary card with token-based pills and chips', () => {
    render(() => (
      <WidgetDetailsView
        widget={widget()}
        description="Shows the time"
        tabs={tabs}
        t={t}
      />
    ));

    const summary = screen.getByRole('region', {
      name: 'widgets.widgetDetails',
    });
    expect(summary).toHaveClass('widget-summary');
    expect(screen.getByText('group')).toHaveAttribute('data-tone', 'info');
    expect(screen.getByText('group')).toHaveAttribute('title', 'common.type');
    expect(screen.getByText('widgets.scope.organization')).toHaveAttribute(
      'data-tone',
      'success'
    );
    expect(screen.getByText('Shows the time')).toBeInTheDocument();
    expect(
      screen.getByText('widgets.details.updatesEvery:{"seconds":60}')
    ).toHaveAttribute('title', 'widgets.updateInterval');
  });

  it('falls back to unknown type and system scope without interval chip', () => {
    render(() => (
      <WidgetDetailsView
        widget={widget({
          template: undefined as any,
          scope: undefined,
          update_interval_seconds: undefined,
          slug: undefined,
        })}
        tabs={tabs}
        t={t}
      />
    ));

    expect(screen.getByText('common.unknown')).toBeInTheDocument();
    expect(screen.getByText('widgets.scope.system')).toHaveAttribute(
      'data-tone',
      'neutral'
    );
    expect(screen.queryByText(/updatesEvery/)).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'widgets.details.copySlug' })
    ).toBeNull();
  });

  it.each([
    ['network', 'info'],
    ['unassigned', 'warning'],
    ['bogus', 'neutral'],
  ])('maps %s scope to the %s tone', (scope, tone) => {
    render(() => (
      <WidgetDetailsView
        widget={widget({ scope: scope as JsonWidget['scope'] })}
        tabs={tabs}
        t={t}
      />
    ));
    const label =
      scope === 'bogus' ? 'widgets.scope.system' : `widgets.scope.${scope}`;
    expect(screen.getByText(label)).toHaveAttribute('data-tone', tone);
  });

  it('copies the widget identifier and reports failures', async () => {
    const onCopyError = vi.fn();
    render(() => (
      <WidgetDetailsView
        widget={widget()}
        tabs={tabs}
        t={t}
        onCopyError={onCopyError}
      />
    ));
    const button = screen.getByRole('button', {
      name: 'widgets.details.copySlug',
    });
    fireEvent.click(button);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('clock');

    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(button);
    await vi.waitFor(() => expect(onCopyError).toHaveBeenCalled());
  });

  it('renders accessible tabs and opens the requested initial tab', () => {
    render(() => (
      <WidgetDetailsView widget={widget()} tabs={tabs} initialIndex={1} t={t} />
    ));
    expect(
      screen.getByRole('tablist', { name: 'common.sections' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('Assets panel')).toBeInTheDocument();
  });
});

describe('JsonHighlight', () => {
  it('highlights JSON tokens and escapes markup', () => {
    const { container } = render(() => (
      <JsonHighlight
        json={{
          html: '<img src=x onerror=alert(1)>',
          count: 3,
          on: true,
          none: null,
        }}
      />
    ));
    const pre = container.querySelector('pre.json-highlight')!;
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(pre.querySelector('img')).toBeNull();
    expect(pre.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(pre.querySelectorAll('.json-key')).toHaveLength(4);
    expect(pre.querySelector('.json-number')).toHaveTextContent('3');
    expect(pre.querySelector('.json-boolean')).toHaveTextContent('true');
    expect(pre.querySelector('.json-null')).toHaveTextContent('null');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders null for undefined values', () => {
    const { container } = render(() => <JsonHighlight json={undefined} />);
    expect(container.querySelector('code')).toHaveTextContent('null');
  });

  it('copies the formatted JSON, announces it and resets the feedback', async () => {
    vi.useFakeTimers();
    const { container } = render(() => (
      <JsonHighlight json={{ a: 1 }} copyLabel="Copy" copiedMessage="Copied" />
    ));
    const status = container.querySelector('.json-viewer-status')!;
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}');
    expect(status).toHaveTextContent('Copied');
    vi.advanceTimersByTime(JSON_COPY_FEEDBACK_MS);
    expect(status).toHaveTextContent('');
  });

  it('reports copy failures', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const onCopyError = vi.fn();
    render(() => (
      <JsonHighlight
        json={{}}
        copyLabel="Copy"
        copiedMessage="Copied"
        onCopyError={onCopyError}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await vi.waitFor(() => expect(onCopyError).toHaveBeenCalled());
  });
});

describe('AssetsList', () => {
  it('lists assets per category and localizes unknown types', () => {
    render(() => (
      <AssetsList
        assets={{
          icons: { sun: { path: 'icons/sun.svg', type: 'image/svg+xml' } },
          images: { bg: { path: 'images/bg.png', type: 'image/png' } },
          fonts: { body: { path: 'fonts/body.woff2' } as any },
          styles: { main: { path: 'styles/main.css', type: 'text/css' } },
        }}
        widgetSlug="weather"
        baseUrl="/api"
        t={t}
      />
    ));
    for (const category of ['icons', 'images', 'fonts', 'styles']) {
      expect(
        screen.getByText(`widgets.assets.${category}`)
      ).toBeInTheDocument();
    }
    expect(screen.getByText('image/svg+xml')).toBeInTheDocument();
    expect(screen.getByText('common.unknown')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'sun' })).toHaveAttribute(
      'src',
      '/api/widget_assets/weather/icons/sun.svg'
    );
  });

  it('shows the empty state', () => {
    render(() => (
      <AssetsList assets={{}} widgetSlug="w" baseUrl="/api" t={t} />
    ));
    expect(screen.getByText('widgets.noAssets')).toBeInTheDocument();
  });
});

describe('widgets.scss', () => {
  const widgetsScss = readFileSync(resolve(__dirname, 'widgets.scss'), 'utf8');
  const widgetsIndex = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
  const block = (selector: string) => {
    const start = widgetsScss.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    return widgetsScss.slice(start, widgetsScss.indexOf('\n}\n', start));
  };

  it('themes the drawer, JSON viewer and assets with tokens only', () => {
    for (const selector of [
      '.widget-details-content {',
      '.json-viewer {',
      '.json-highlight {',
      '.assets-list {',
    ]) {
      expect(block(selector)).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
    expect(widgetsScss).not.toContain('widget-details-modal');
    expect(widgetsScss).not.toContain('widget-metadata');
  });

  it('scrolls JSON horizontally and stacks assets on phones', () => {
    expect(block('.json-highlight {')).toContain('overflow-x: auto');
    expect(block('.json-highlight {')).toContain('direction: ltr');
    expect(block('.assets-list {')).toMatch(
      /@media \(max-width: 36em\) \{\s*grid-template-columns: 1fr;/
    );
  });

  it('leaves upload modal sizing to the shared Modal', () => {
    expect(widgetsScss).not.toContain('!important');
    expect(widgetsScss).not.toContain('.widget-upload-modal {');
    expect(widgetsIndex).not.toMatch(
      /modalElement\.style\.(?:width|maxWidth|minWidth)/
    );
    expect(block('.upload-widgets {')).toMatch(
      /@media \(max-width: 36em\) \{\s*padding: 0;/
    );
    expect(block('.upload-widgets {')).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
