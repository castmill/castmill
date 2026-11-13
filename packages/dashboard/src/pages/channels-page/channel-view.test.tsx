import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { ChannelView } from './channel-view';
import type { JsonChannel } from '../../services/channels.service';

const automationsProps = vi.fn();

vi.mock('./channel-automations', () => ({
  ChannelAutomations: (props: {
    range?: { start: number; end: number };
    onMarkersChange: (markers: { time: number; label: string }[]) => void;
  }) => {
    automationsProps(props);
    props.onMarkersChange([{ time: 5, label: 'Marker' }]);
    return <div data-testid="automations" />;
  },
}));
vi.mock('./calendar-view', () => ({
  CalendarView: (props: {
    markers?: { label: string }[];
    onWeekChange: (start: number, end: number) => void;
  }) => {
    props.onWeekChange(10, 20);
    // Unchanged ranges are ignored.
    props.onWeekChange(10, 20);
    return (
      <div data-testid="calendar">
        {props.markers?.map((marker) => marker.label).join(',')}
      </div>
    );
  },
}));

describe('ChannelView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks the notice, automations and the calendar', () => {
    const channel = { id: 3, name: 'Main', timezone: 'UTC' } as JsonChannel;
    const { container } = render(() => (
      <I18nProvider>
        <ChannelView organizationId="org" channel={channel} />
      </I18nProvider>
    ));

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/channel-view/);
    expect(root.getAttribute('style')).toBeNull();
    expect(
      screen.getByText(
        'To display content, set a default playlist or add a scheduled entry for this channel.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('calendar')).toHaveTextContent('Marker');
    expect(automationsProps.mock.lastCall![0].range).toEqual({
      start: 10,
      end: 20,
    });
  });
});
