import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import {
  AutomationRule,
  AutomationsService,
} from '../../services/automations.service';
import { RulesTab, RulesTabProps, moveItem } from './rules-tab';
import { rememberPlaylist } from './playlist-names';
import { automationFixture, clockRule } from './test-fixtures';

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return { ...actual, AutomationsService: { preview: vi.fn() } };
});
vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = vi.fn().mockResolvedValue({ count: 0, data: [] });
    fetchPlaylist = vi
      .fn()
      .mockResolvedValue({ data: { id: 12, name: 'Spring offer' } });
  },
}));
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));
vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));

let onRulesChange: ReturnType<typeof vi.fn>;
let onRun: ReturnType<typeof vi.fn>;

const renderTab = (props: Partial<RulesTabProps> = {}) =>
  render(() => (
    <I18nProvider>
      <RulesTab
        automation={automationFixture()}
        organizationId="org-1"
        canEdit
        serverSources={['clock']}
        serverActions={['interrupt']}
        onRulesChange={onRulesChange}
        onRun={onRun}
        {...props}
      />
    </I18nProvider>
  ));

const ids = () =>
  (onRulesChange.mock.lastCall![0] as AutomationRule[]).map((r) => r.id);

describe('moveItem', () => {
  it('moves items and ignores invalid moves', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], -1, 1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 5, 1)).toEqual([1, 2, 3]);
  });
});

describe('RulesTab', () => {
  beforeEach(() => {
    onRulesChange = vi.fn().mockResolvedValue(true);
    onRun = vi.fn().mockResolvedValue(undefined);
    vi.mocked(AutomationsService.preview).mockResolvedValue({
      timezone: 'UTC',
      occurrences: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders rules as plain-language cards', async () => {
    renderTab();
    const cards = screen.getAllByTestId('rule-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Every hour at :08');
    expect(cards[0]).toHaveTextContent('playlist #12');
    rememberPlaylist(12, 'Spring offer');
    await waitFor(() => expect(cards[0]).toHaveTextContent('Spring offer'));
  });

  it('shows an empty state', () => {
    renderTab({ automation: automationFixture({ rules: [] }) });
    expect(
      screen.getByText(/This automation has no rules yet/)
    ).toBeInTheDocument();
  });

  it('reorders with the move buttons and announces it', async () => {
    renderTab();
    expect(
      screen.getByRole('button', { name: 'Move rule 1 up' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move rule 2 down' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move rule 1 down' }));
    await waitFor(() => expect(ids()).toEqual(['r2', 'r1']));
    expect(
      await screen.findByText('Rule moved from position 1 to 2')
    ).toBeInTheDocument();
  });

  it('does not announce failed moves', async () => {
    onRulesChange.mockResolvedValue(false);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Move rule 2 up' }));
    await waitFor(() => expect(onRulesChange).toHaveBeenCalled());
    expect(screen.queryByText(/Rule moved/)).not.toBeInTheDocument();
  });

  it('reorders with drag and drop', async () => {
    renderTab();
    const [first, second] = screen.getAllByTestId('rule-card');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(second, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '1');
    fireEvent.dragOver(first);
    fireEvent.dragLeave(first);
    fireEvent.dragOver(first);
    fireEvent.drop(first);
    await waitFor(() => expect(ids()).toEqual(['r2', 'r1']));

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragEnd(first);
    fireEvent.drop(second);
    expect(onRulesChange).toHaveBeenCalledTimes(1);
  });

  it('ignores drag over without an active drag', () => {
    renderTab();
    const [first] = screen.getAllByTestId('rule-card');
    fireEvent.dragOver(first);
    fireEvent.drop(first);
    expect(onRulesChange).not.toHaveBeenCalled();
  });

  it('deletes a rule after confirmation', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    fireEvent.click(await screen.findByText('Cancel'));
    expect(onRulesChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() => expect(ids()).toEqual(['r2']));
  });

  it('runs a rule now', async () => {
    let finish!: () => void;
    onRun.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    renderTab();
    const run = screen.getByRole('button', { name: 'Run rule 1 now' });
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    expect(run).toBeDisabled();
    finish();
    await waitFor(() => expect(run).not.toBeDisabled());
  });

  it('cannot run unsaved rules', () => {
    const rule = clockRule('x', 5);
    delete rule.id;
    renderTab({ automation: automationFixture({ rules: [rule] }) });
    expect(
      screen.getByRole('button', { name: 'Run rule 1 now' })
    ).toBeDisabled();
  });

  it('shows capability warnings and cooldowns', () => {
    const rule = { ...clockRule('r1', 8), cooldown_seconds: 60 };
    renderTab({
      automation: automationFixture({
        rules: [rule],
        warnings: [
          {
            rule_id: 'r1',
            device_id: 'd1',
            device_name: 'Lobby',
            missing: 'automation_actions:interrupt',
          },
          {
            rule_id: 'r1',
            device_id: 'd2',
            device_name: 'Hall',
            missing: 'automation_sources:clock',
          },
          {
            rule_id: 'other',
            device_id: 'd3',
            device_name: 'Elsewhere',
            missing: 'automation_sources:clock',
          },
        ],
      }),
    });
    expect(
      screen.getByText('Lobby does not support Interrupt with content')
    ).toBeInTheDocument();
    expect(screen.getByText(/Hall does not support/)).toBeInTheDocument();
    expect(screen.queryByText(/Elsewhere/)).not.toBeInTheDocument();
    expect(screen.getByTestId('rule-card')).toHaveTextContent('60');
  });

  it('hides editing controls for read-only users', () => {
    renderTab({ canEdit: false });
    expect(
      screen.queryByRole('button', { name: 'Delete rule 1' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add rule' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('rule-card')[0]).toHaveAttribute(
      'draggable',
      'false'
    );
  });

  it('edits and adds rules through the drawer', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule 2' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(ids()).toEqual(['r1', 'r2']));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Save rule' })
      ).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(
      await screen.findByRole('button', { name: 'Save rule' })
    ).toBeInTheDocument();
  });
});
