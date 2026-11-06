// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { BsQuestion } from 'solid-icons/bs';
import { I18nProvider } from '../../i18n';
import {
  AutomationRule,
  AutomationsService,
} from '../../services/automations.service';
import { RuleDrawer } from './rule-drawer';
import {
  actionEditors,
  registerAction,
  registerSource,
  ruleSummary,
  sourceEditors,
  unregisterAction,
  unregisterSource,
} from './registry';
import type { TypeEditorProps } from './registry-types';
import { testSummaryContext } from './test-utils';

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return {
    ...actual,
    AutomationsService: { preview: vi.fn() },
  };
});

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = vi.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 12, name: 'Spring offer' }],
    });
    fetchPlaylist = vi
      .fn()
      .mockResolvedValue({ data: { id: 12, name: 'Spring offer' } });
  },
}));

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children as string}
    </a>
  ),
}));

interface StubConfig {
  value: string;
}

const StubSourceEditor = (props: TypeEditorProps<StubConfig>) => (
  <label>
    Stub source value
    <input
      data-testid="stub-source-editor"
      value={props.config.value}
      onInput={(e) => props.onChange({ value: e.currentTarget.value })}
    />
  </label>
);

const StubActionEditor = (props: TypeEditorProps<StubConfig>) => (
  <label>
    Stub action value
    <input
      data-testid="stub-action-editor"
      value={props.config.value}
      onInput={(e) => props.onChange({ value: e.currentTarget.value })}
    />
  </label>
);

const renderDrawer = (
  props: Partial<Parameters<typeof RuleDrawer>[0]> = {}
) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(() => (
    <I18nProvider>
      <RuleDrawer
        organizationId="org-1"
        serverSources={null}
        serverActions={null}
        onSave={onSave}
        onClose={onClose}
        {...props}
      />
    </I18nProvider>
  ));
  return { onSave, onClose };
};

const saveButton = () => screen.getByRole('button', { name: 'Save rule' });

describe('RuleDrawer', () => {
  beforeEach(() => {
    vi.mocked(AutomationsService.preview).mockResolvedValue({
      timezone: 'UTC',
      occurrences: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates a clock → interrupt rule by default', async () => {
    const { onSave } = renderDrawer();
    expect(await screen.findByTestId('clock-editor')).toBeInTheDocument();
    expect(screen.getByTestId('interrupt-editor')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Clock/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // A playlist is required.
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Choose a playlist.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('edits and saves an existing rule with a normalized config', async () => {
    const rule: AutomationRule = {
      id: 'r1',
      when: {
        source: 'clock',
        condition: 'at',
        config: {
          schedule: { type: 'hourly', minute: 8 },
          weekdays: null,
          window: null,
          dates: null,
          timezone: null,
        },
      },
      then: {
        action: 'interrupt',
        config: {
          playlist_id: 12,
          start: 'immediately',
          max_wait_seconds: 120,
          plays: 1,
          priority: 'normal',
        },
      },
      cooldown_seconds: 0,
    };
    const { onSave } = renderDrawer({ rule });
    expect(await screen.findByText('Edit rule')).toBeInTheDocument();

    const cooldown = screen.getByLabelText(/Cooldown \(seconds\)/);
    fireEvent.input(cooldown, { target: { value: '' } });
    expect(
      screen.getByText(
        'The cooldown must be a whole number of seconds (0 or more).'
      )
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.input(cooldown, { target: { value: '60' } });
    expect(saveButton()).not.toBeDisabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as AutomationRule;
    expect(saved.id).toBe('r1');
    expect(saved.cooldown_seconds).toBe(60);
    expect(saved.when.config).toEqual({
      schedule: { type: 'hourly', minute: 8 },
      weekdays: null,
    });
    expect(saved.then.config).not.toHaveProperty('max_wait_seconds');
    // The original rule is not mutated.
    expect(rule.cooldown_seconds).toBe(0);
  });

  it('shows a notice for types this dashboard does not know', async () => {
    renderDrawer({
      rule: {
        when: { source: 'motion', condition: 'x', config: {} },
        then: { action: 'mute', config: {} },
        cooldown_seconds: 0,
      },
    });
    expect(
      await screen.findByText('Unsupported type "motion"')
    ).toBeInTheDocument();
    expect(screen.getByText('Unsupported type "mute"')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('closes on cancel', async () => {
    const { onClose } = renderDrawer();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('registry extensibility', () => {
  beforeEach(() => {
    vi.mocked(AutomationsService.preview).mockResolvedValue({
      timezone: 'UTC',
      occurrences: [],
    });
    registerSource<StubConfig>({
      type: 'test-source',
      condition: 'happens',
      icon: BsQuestion,
      label: () => 'Test source',
      description: () => 'A source registered by the test',
      defaultConfig: () => ({ value: '' }),
      editor: StubSourceEditor,
      summary: (config) => `test source "${config.value}"`,
      validate: (config) =>
        config.value ? [] : ['automations.validation.source'],
    });
    registerAction<StubConfig>({
      type: 'test-action',
      icon: BsQuestion,
      label: () => 'Test action',
      description: () => 'An action registered by the test',
      defaultConfig: () => ({ value: 'default' }),
      editor: StubActionEditor,
      summary: (config) => `test action "${config.value}"`,
      validate: () => [],
      normalize: (config) => ({ value: config.value.toUpperCase() }),
    });
  });

  afterEach(() => {
    cleanup();
    unregisterSource('test-source');
    unregisterAction('test-action');
    vi.clearAllMocks();
  });

  it('renders and saves registered types without page changes', async () => {
    expect(sourceEditors['test-source']).toBe(StubSourceEditor);
    expect(actionEditors['test-action']).toBe(StubActionEditor);

    const { onSave } = renderDrawer();

    fireEvent.click(await screen.findByRole('radio', { name: /Test source/ }));
    expect(screen.getByTestId('stub-source-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('clock-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Test action/ }));
    expect(screen.getByTestId('stub-action-editor')).toHaveValue('default');
    expect(screen.queryByTestId('interrupt-editor')).not.toBeInTheDocument();

    // The stub validator requires a value.
    expect(saveButton()).toBeDisabled();
    fireEvent.input(screen.getByTestId('stub-source-editor'), {
      target: { value: 'door opened' },
    });
    fireEvent.input(screen.getByTestId('stub-action-editor'), {
      target: { value: 'beep' },
    });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0] as AutomationRule;
    expect(saved).toEqual({
      when: {
        source: 'test-source',
        condition: 'happens',
        config: { value: 'door opened' },
      },
      then: { action: 'test-action', config: { value: 'BEEP' } },
      cooldown_seconds: 0,
    });
    expect(ruleSummary(saved, testSummaryContext())).toBe(
      'test source "door opened" → test action "BEEP"'
    );

    // Switching back restores the default editor of the registered type.
    fireEvent.click(screen.getByRole('radio', { name: /Clock/ }));
    expect(screen.getByTestId('clock-editor')).toBeInTheDocument();
  });

  it('hides types the server does not support', async () => {
    renderDrawer({
      serverSources: ['clock'],
      serverActions: ['interrupt'],
    });
    expect(
      await screen.findByRole('radio', { name: /Clock/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Test source/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Test action/ })
    ).not.toBeInTheDocument();
  });

  it('unregisters types', () => {
    unregisterSource('test-source');
    unregisterAction('test-action');
    expect(sourceEditors['test-source']).toBeUndefined();
    expect(actionEditors['test-action']).toBeUndefined();
  });
});
