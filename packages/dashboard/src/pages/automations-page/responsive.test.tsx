// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { I18nProvider } from '../../i18n';
import { LOCALE_STORAGE_KEY } from '../../i18n/types';
import { AutomationEditor } from './automation-editor';
import { RuleDrawer } from './rule-drawer';
import { InterruptEditor } from './actions/interrupt-editor';
import { defaultInterruptConfig } from './actions/interrupt-logic';
import { automationFixture } from './test-fixtures';

import styles from './automations.module.scss';

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return {
    ...actual,
    AutomationsService: { preview: vi.fn().mockResolvedValue({ data: [] }) },
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
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  };
});

const PHONE_QUERY = '(max-width: 36em)';

/** Style rules inside the phone media query of the compiled stylesheet. */
const phoneRules = (): CSSStyleRule[] => {
  const css = compile(resolve(__dirname, 'automations.module.scss')).css;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const media = Array.from(style.sheet!.cssRules).filter(
    (rule): rule is CSSMediaRule =>
      rule instanceof CSSMediaRule && rule.media.mediaText === PHONE_QUERY
  );
  style.remove();
  return media.flatMap((rule) =>
    Array.from(rule.cssRules).filter(
      (inner): inner is CSSStyleRule => inner instanceof CSSStyleRule
    )
  );
};

describe('Automation editor on small screens', () => {
  let rules: CSSStyleRule[];
  const originalMatchMedia = window.matchMedia;

  const ruleFor = (selector: string) => {
    const rule = rules.find((candidate) =>
      candidate.selectorText
        .split(',')
        .some((part) => part.trim().replace(/['"]/g, '') === selector)
    );
    expect(rule, selector).toBeDefined();
    return rule!.style;
  };

  beforeAll(() => {
    rules = phoneRules();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.matchMedia = originalMatchMedia;
  });

  describe('phone stylesheet', () => {
    it('stacks the name field and enabled toggle', () => {
      const header = ruleFor('.editorHeader');
      expect(header.getPropertyValue('flex-direction')).toBe('column');
      expect(header.getPropertyValue('align-items')).toBe('stretch');
      expect(
        ruleFor('.editorHeader .field input[type=text]').getPropertyValue(
          'max-width'
        )
      ).toBe('none');
      expect(
        ruleFor('.editorHeader .switch').getPropertyValue('align-self')
      ).toBe('flex-start');
    });

    it('gives each step picker card the full width', () => {
      const card = ruleFor('.typeCard');
      expect(card.getPropertyValue('flex-basis')).toBe('100%');
      expect(card.getPropertyValue('max-width')).toBe('none');
    });

    it('stacks the schedule segmented control', () => {
      expect(ruleFor('.segmented').getPropertyValue('flex-direction')).toBe(
        'column'
      );
      const button = ruleFor('.segmented button');
      expect(button.getPropertyValue('border-inline-end')).toBe('none');
      expect(button.getPropertyValue('text-align')).toBe('start');
    });

    it.each(['.drawerFooter', '.tabFooter', '.formActions'])(
      'makes %s buttons full width',
      (footer) => {
        const container = ruleFor(footer);
        expect(container.getPropertyValue('flex-direction')).toBe('column');
        expect(container.getPropertyValue('align-items')).toBe('stretch');
        expect(ruleFor(`${footer} > *`).getPropertyValue('width')).toBe('100%');
      }
    );

    it('moves rule card actions to their own row', () => {
      expect(ruleFor('.ruleCard').getPropertyValue('flex-wrap')).toBe('wrap');
      const actions = ruleFor('.ruleActions');
      expect(actions.getPropertyValue('flex-basis')).toBe('100%');
      expect(actions.getPropertyValue('justify-content')).toBe('flex-end');
    });
  });

  it('renders the name field and toggle in the stacking header and uses responsive tabs', () => {
    render(() => (
      <I18nProvider>
        <AutomationEditor
          organizationId="org-1"
          automation={automationFixture()}
          canEdit
          serverSources={null}
          serverActions={null}
          onChange={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>
    ));

    const header = document.querySelector(`.${styles.editorHeader}`)!;
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByRole('textbox')).toHaveValue(
      'Spring campaign'
    );
    expect(
      within(header as HTMLElement).getByRole('switch', { name: 'Enabled' })
    ).toHaveClass(styles.switch);

    // Shared Tabs collapse inactive icon tabs to icon-only on phones.
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    tabs.forEach((tab) => {
      expect(tab.querySelector('svg')).not.toBeNull();
      expect(tab).toHaveAttribute('title');
    });
  });

  it('renders rule drawer footer buttons and step pickers with the phone classes', () => {
    render(() => (
      <I18nProvider>
        <RuleDrawer
          organizationId="org-1"
          serverSources={null}
          serverActions={null}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>
    ));

    const footer = document.querySelector(`.${styles.drawerFooter}`)!;
    expect(footer).not.toBeNull();
    expect(
      Array.from(footer.children).map((button) => button.textContent)
    ).toEqual(['Cancel', 'Save rule']);

    const pickers = document.querySelectorAll(`.${styles.typeCards}`);
    expect(pickers).toHaveLength(2);
    pickers.forEach((picker) =>
      picker
        .querySelectorAll('[role="radio"]')
        .forEach((card) => expect(card).toHaveClass(styles.typeCard))
    );
  });

  it('localizes the playlist picker bottom sheet close button on phones', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    window.matchMedia = vi.fn(
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList
    );

    render(() => (
      <I18nProvider>
        <InterruptEditor
          config={defaultInterruptConfig()}
          onChange={vi.fn()}
          organizationId="org-1"
          errors={[]}
        />
      </I18nProvider>
    ));

    (await screen.findByText('Buscar una lista…')).click();
    const sheet = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[data-combobox-sheet]'
      );
      expect(element).not.toBeNull();
      return element!;
    });
    expect(
      within(sheet).getByRole('button', { name: 'Cerrar' })
    ).toBeInTheDocument();
  });
});
