import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'sass';

const PHONE = '(max-width: 36em)';
const TABLET = '(max-width: 48em)';
const TOUCH = '(hover: none), (pointer: coarse)';

/** Compiles a stylesheet (relative to src/) and parses it with jsdom. */
const loadSheet = (path: string): CSSRuleList => {
  const file = resolve(__dirname, '..', path);
  const css = file.endsWith('.css')
    ? readFileSync(file, 'utf8')
    : compile(file).css;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const rules = style.sheet!.cssRules;
  style.remove();
  return rules;
};

const styleRules = (rules: CSSRuleList) =>
  Array.from(rules).filter(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule
  );

/** Style rules inside media queries with the given condition. */
const mediaRules = (rules: CSSRuleList, query: string): CSSStyleRule[] =>
  Array.from(rules)
    .filter(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule && rule.media.mediaText === query
    )
    .flatMap((rule) => styleRules(rule.cssRules));

/** Declaration of the last rule matching the selector exactly. */
const declaration = (
  rules: CSSStyleRule[],
  selector: string,
  property: string
): string => {
  const matches = rules.filter((rule) =>
    rule.selectorText.split(/,\s*/).includes(selector)
  );
  expect(matches, `no rule for ${selector}`).not.toHaveLength(0);
  return matches.at(-1)!.style.getPropertyValue(property);
};

describe('Settings page on small screens', () => {
  const sheet = loadSheet('pages/settings-page/settings-page.scss');
  const SECTION = '.castmill-settings .settings-section';

  it('stays within an em-based width and aligns to the start edge', () => {
    const base = styleRules(sheet);
    expect(declaration(base, '.castmill-settings', 'max-width')).toBe('50em');
    expect(declaration(base, '.castmill-settings', 'text-align')).toBe('start');
  });

  it('uses the page gutter on tablets', () => {
    expect(
      declaration(mediaRules(sheet, TABLET), '.castmill-settings', 'padding')
    ).toBe('var(--cm-page-gutter, 1em)');
  });

  it('stacks form and passkey actions on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(
      declaration(phone, `${SECTION} .form-actions`, 'flex-direction')
    ).toBe('column');
    expect(
      declaration(
        phone,
        `${SECTION} .passkey-info .passkey-list .passkey-item .passkey-info-row`,
        'flex-direction'
      )
    ).toBe('column');
    expect(
      declaration(
        phone,
        `${SECTION} .onboarding-reset-actions`,
        'flex-direction'
      )
    ).toBe('column');
    expect(
      declaration(
        phone,
        `${SECTION} .language-options`,
        'grid-template-columns'
      )
    ).toBe('1fr');
  });

  it('enlarges language options for touch', () => {
    expect(
      declaration(
        mediaRules(sheet, TOUCH),
        `${SECTION} .language-options .language-option`,
        'min-height'
      )
    ).toBe('2.75em');
  });
});

describe('Usage page on small screens', () => {
  const sheet = loadSheet('pages/usage-page/usage-page.module.scss');

  it('never makes cards wider than a phone', () => {
    expect(
      declaration(styleRules(sheet), '.grid', 'grid-template-columns')
    ).toBe('repeat(auto-fill, minmax(min(100%, 22em), 1fr))');
  });

  it('uses one column and compact cards on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.grid', 'grid-template-columns')).toBe(
      'minmax(0, 1fr)'
    );
    expect(declaration(phone, '.card', 'padding')).toBe('1rem');
  });

  it('uses the page gutter on tablets', () => {
    expect(
      declaration(mediaRules(sheet, TABLET), '.usage-page', 'padding')
    ).toBe('var(--cm-page-gutter, 1rem)');
  });
});

describe('Organization page on small screens', () => {
  const sheet = loadSheet(
    'pages/organization-page/organization-page.module.scss'
  );

  it('uses the shared gutter and start alignment', () => {
    const base = styleRules(sheet);
    expect(declaration(base, '.organization-page', 'margin')).toBe(
      'var(--cm-page-gutter, 1em)'
    );
    expect(declaration(base, '.organization-page', 'text-align')).toBe('start');
  });

  it('stacks the name form and the leave panel on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(
      declaration(
        phone,
        '.organization-page .header .form-inputs',
        'flex-direction'
      )
    ).toBe('column');
    expect(
      declaration(phone, '.leave-organization-panel', 'flex-direction')
    ).toBe('column');
  });
});

describe.each([
  'pages/organization-invitations/organizations-invitations-page.scss',
  'pages/teams-invitations-page/teams-invitations-page.scss',
])('Invitation page %s on small screens', (path) => {
  const sheet = loadSheet(path);

  it('keeps the card within the viewport and scrollable', () => {
    const base = styleRules(sheet);
    expect(declaration(base, '.castmill-invitation', 'align-items')).toBe(
      'flex-start'
    );
    expect(
      declaration(base, '.castmill-invitation .invitation-box', 'max-width')
    ).toBe('100%');
    expect(
      declaration(base, '.castmill-invitation .email-box', 'text-align')
    ).toBe('start');
  });

  it('stacks the accept and reject buttons on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(
      declaration(
        phone,
        '.castmill-invitation .action-buttons',
        'flex-direction'
      )
    ).toBe('column');
    expect(
      declaration(
        phone,
        '.castmill-invitation .action-buttons button',
        'min-height'
      )
    ).toBe('2.75em');
  });
});

describe('Search page on small screens', () => {
  const sheet = loadSheet('pages/search-page/search-page.scss');

  it('uses logical properties for alignment and hover', () => {
    const base = styleRules(sheet);
    expect(declaration(base, '.search-page', 'padding')).toBe(
      'var(--cm-page-gutter, 2em)'
    );
    expect(
      declaration(base, '.search-result-item:hover', 'padding-inline-start')
    ).toBe('2em');
    expect(
      declaration(base, '.search-result-item__content', 'text-align')
    ).toBe('start');
  });

  it('mirrors the result chevron in RTL', () => {
    expect(
      declaration(
        styleRules(sheet),
        '[dir=rtl] .search-result-item__arrow',
        'transform'
      )
    ).toContain('scaleX(-1)');
  });

  it('shrinks the header and removes the hover shift on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.search-page__title', 'font-size')).toBe(
      '1.5em'
    );
    expect(
      declaration(phone, '.search-result-item:hover', 'padding-inline-start')
    ).toBe('1em');
  });
});

describe('Feeds pages on small screens', () => {
  const sheet = loadSheet('pages/feeds-page/feeds-page.module.scss');

  it('lets modal forms fill the bottom sheet on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.form', 'min-width')).toBe('0');
    expect(declaration(phone, '.testForm', 'min-width')).toBe('0');
    expect(declaration(phone, '.header', 'flex-direction')).toBe('column');
    expect(declaration(phone, '.endpointLabel', 'flex-basis')).toBe('100%');
  });

  it('makes icon buttons tap-friendly', () => {
    expect(
      declaration(mediaRules(sheet, TOUCH), '.iconButton', 'min-height')
    ).toBe('2.75em');
  });
});

describe('Network pages on small screens', () => {
  const sheet = loadSheet('pages/network/network.module.scss');

  it('keeps grids within a phone width', () => {
    const base = styleRules(sheet);
    expect(
      declaration(base, '.network-page .form-grid', 'grid-template-columns')
    ).toBe('repeat(auto-fit, minmax(min(100%, 20em), 1fr))');
    expect(
      declaration(base, '.network-page .stats-grid', 'grid-template-columns')
    ).toBe('repeat(auto-fit, minmax(min(100%, 12em), 1fr))');
  });

  it('turns data tables into labelled cards on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.network-page .data-table tr', 'display')).toBe(
      'block'
    );
    expect(declaration(phone, '.network-page .data-table td', 'display')).toBe(
      'flex'
    );
    expect(
      declaration(phone, '.network-page .data-table td::before', 'content')
    ).toBe('attr(data-label)');
    expect(
      declaration(phone, '.network-page .data-table thead', 'position')
    ).toBe('absolute');
  });

  it('stacks forms and modal actions on phones', () => {
    const phone = mediaRules(sheet, PHONE);
    expect(
      declaration(phone, '.network-page .create-org-row', 'flex-direction')
    ).toBe('column');
    expect(declaration(phone, '.modal-actions', 'flex-direction')).toBe(
      'column-reverse'
    );
  });

  it('enlarges row action buttons for touch', () => {
    expect(
      declaration(
        mediaRules(sheet, TOUCH),
        '.network-page .actions-row > button',
        'min-height'
      )
    ).toBe('2.75em');
  });
});

describe('Auth pages on small screens', () => {
  const login = loadSheet('components/login/login.scss');
  const signup = loadSheet('components/signup/signup.scss');
  const SHORT_OR_PHONE = '(max-width: 36em), (max-height: 40em)';

  it('never lets the card exceed the viewport', () => {
    for (const [sheet, root] of [
      [login, '.castmill-login'],
      [signup, '.castmill-signup'],
    ] as const) {
      const base = styleRules(sheet);
      expect(declaration(base, `${root} .login-box`, 'max-width')).toBe('100%');
      expect(declaration(base, `${root} .login-box`, 'min-height')).toBe(
        '35rem'
      );
      expect(declaration(base, `${root} button`, 'max-width')).toBe('100%');
    }
  });

  it('uses theme tokens and logical borders for login errors', () => {
    const base = styleRules(login);
    expect(
      declaration(base, '.castmill-login .error', 'background-color')
    ).toBe('var(--cm-error-bg)');
    expect(
      declaration(base, '.castmill-login .error', 'border-inline-start')
    ).toBe('0.25em solid var(--cm-error)');
  });

  it('drops the fixed offset and widens controls on phones', () => {
    const phone = mediaRules(login, SHORT_OR_PHONE);
    expect(
      declaration(phone, '.castmill-login .login-container', 'height')
    ).toBe('auto');
    expect(declaration(phone, '.castmill-login button', 'width')).toBe('100%');
    expect(declaration(phone, '.castmill-login button', 'min-height')).toBe(
      '2.75em'
    );

    const signupPhone = mediaRules(signup, SHORT_OR_PHONE);
    expect(declaration(signupPhone, '.castmill-signup', 'height')).toBe('auto');
  });
});

describe('Error pages on small screens', () => {
  it('shrinks the 404 heading on phones', () => {
    const sheet = loadSheet('components/not-found.module.scss');
    expect(declaration(styleRules(sheet), '.notFound', 'min-height')).toBe(
      '80vh'
    );
    expect(
      declaration(mediaRules(sheet, PHONE), '.errorCode', 'font-size')
    ).toBe('4em');
  });

  it('uses logical properties and a full-width retry on phones', () => {
    const sheet = loadSheet('components/server-error/server-error.css');
    const base = styleRules(sheet);
    expect(
      declaration(base, '.server-error-suggestions', 'padding-inline-start')
    ).toBe('1.5em');
    expect(declaration(base, '.server-error-suggestions', 'text-align')).toBe(
      'start'
    );
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.server-error-retry-button', 'width')).toBe(
      '100%'
    );
    expect(declaration(phone, '.server-error-content', 'padding')).toBe(
      '1.5em 1.25em'
    );
  });
});

describe('Onboarding on phones', () => {
  it('shows the onboarding dialog as a bottom sheet', () => {
    const phone = mediaRules(
      loadSheet('components/onboarding-dialog/onboarding-dialog.scss'),
      PHONE
    );
    expect(
      declaration(phone, '.onboarding-dialog-overlay', 'align-items')
    ).toBe('flex-end');
    expect(declaration(phone, '.onboarding-dialog', 'width')).toBe('100%');
    expect(declaration(phone, '.onboarding-dialog-button', 'width')).toBe(
      '100%'
    );
  });

  it('shows the tour as a bottom sheet with dots on their own row', () => {
    const sheet = loadSheet('components/onboarding-tour/onboarding-tour.scss');
    const phone = mediaRules(sheet, PHONE);
    expect(declaration(phone, '.onboarding-tour-overlay', 'align-items')).toBe(
      'flex-end'
    );
    expect(declaration(phone, '.onboarding-tour-dots', 'flex-basis')).toBe(
      '100%'
    );
    expect(declaration(phone, '.onboarding-tour-dots', 'order')).toBe('-1');
    expect(
      declaration(phone, '.onboarding-tour-nav-button', 'min-height')
    ).toBe('2.75em');
    expect(
      declaration(
        styleRules(sheet),
        '.onboarding-tour-close',
        'margin-inline-start'
      )
    ).toBe('1em');
    expect(
      declaration(
        styleRules(sheet),
        '[dir=rtl] .onboarding-tour-nav-arrow',
        'transform'
      )
    ).toBe('scaleX(-1)');
  });
});
