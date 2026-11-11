// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import type {
  Automation,
  AutomationRule,
} from '../../services/automations.service';

export const clockRule = (
  id: string,
  minute: number,
  playlistId = 12
): AutomationRule => ({
  id,
  when: {
    source: 'clock',
    condition: 'at',
    config: {
      schedule: { type: 'hourly', minute },
      weekdays: null,
      window: null,
      dates: null,
      timezone: null,
    },
  },
  then: {
    action: 'interrupt',
    config: {
      playlist_id: playlistId,
      start: 'immediately',
      plays: 1,
      priority: 'normal',
    },
  },
  cooldown_seconds: 0,
});

export const automationFixture = (
  overrides: Partial<Automation> = {}
): Automation => ({
  id: 1,
  name: 'Spring campaign',
  enabled: true,
  organization_id: 'org-1',
  rules: [clockRule('r1', 8), clockRule('r2', 30)],
  inserted_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  devices: [],
  channels: [],
  next_firing: null,
  warnings: [],
  ...overrides,
});
