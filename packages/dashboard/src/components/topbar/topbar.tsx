import {
  Component,
  Show,
  createEffect,
  createSignal,
  createMemo,
} from 'solid-js';
import './topbar.scss';

import { checkAuth, getUser, resetSession, authFetch } from '../auth';
import { A, useNavigate } from '@solidjs/router';
import TopbarLink from '../topbar-link/topbar-link';
import Search from '../search/search';

// Find any icon here: https://solid-icons.vercel.app/search/settings
import { FaRegularBell } from 'solid-icons/fa';
import {
  TbHelpCircle,
  TbKeyboard,
  TbMenu2,
  TbRocket,
  TbSearch,
  TbX,
} from 'solid-icons/tb';
import { useMediaQuery } from '@castmill/ui-common';

import defaultLogo from '../../assets/castmill-logo-topbar.png';
import defaultLogoLight from '../../assets/castmill-logo-topbar-light.png';
import DropdownMenu from '../dropdown-menu/dropdown-menu';
import LanguageSelector from '../language-selector/language-selector';
import { LoadingProgressBar } from '../loading-progress-bar/loading-progress-bar';
import NotificationBell from '../notification-bell/notification-bell';
import { ThemeToggle, useTheme, resolveNetworkLogo } from '../../theme';

import { baseUrl } from '../../env';
import { useI18n } from '../../i18n';
import { store, setStore } from '../../store/store';
import { ShortcutsLegend } from '../shortcuts-legend/shortcuts-legend';
import { GlobalShortcuts } from '../global-shortcuts/global-shortcuts';
import { useSelectedOrganizationLogo } from '../../hooks/use-selected-organization-logo';
import { OnboardingStep } from '../../interfaces/onboarding-progress.interface';
import { ONBOARDING_STEPS } from '../../config/onboarding-steps';
import TopbarOverflowMenu from './topbar-overflow-menu';
import {
  COMPACT_TOPBAR_QUERY,
  NAV_COLLAPSED_QUERY,
  NAV_DRAWER_ID,
  TOUCH_QUERY,
  navDrawer,
} from '../sidepanel/nav-drawer';

const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/** First character (not UTF-16 unit) of the user's name, for the avatar. */
export const userInitial = (label: string) =>
  (Array.from(label.trim())[0] ?? '?').toUpperCase();

const Topbar: Component = () => {
  const [triggerLogout, setTriggerLogout] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const { t } = useI18n();
  const { logoUrl: selectedOrgLogo } = useSelectedOrganizationLogo();

  const { theme } = useTheme();

  // Pick the network logo variant for the current theme, falling back to the
  // bundled Castmill logos when the network has not configured one.
  const networkLogo = createMemo(() =>
    resolveNetworkLogo(
      theme(),
      {
        logo: store.networkSettings.logo,
        logoLight: store.networkSettings.logoLight,
      },
      { dark: defaultLogo, light: defaultLogoLight }
    )
  );

  const navigate = useNavigate();

  // Compact layout for phones and portrait tablets; the menu button is shown
  // whenever the side panel is collapsed (drawer or icon rail).
  const compact = useMediaQuery(COMPACT_TOPBAR_QUERY, false);
  const collapsedNav = useMediaQuery(NAV_COLLAPSED_QUERY, false);
  const touch = useMediaQuery(TOUCH_QUERY, false);
  const showShortcutsUi = () =>
    !touch() && !MOBILE_USER_AGENT.test(navigator.userAgent);
  const showMenuButton = () => collapsedNav() && navDrawer.isAvailable();

  const [searchOpen, setSearchOpen] = createSignal(false);
  createEffect(() => {
    if (!compact()) setSearchOpen(false);
  });

  const userLabel = () => getUser().name || getUser().email || '';

  const startOnboarding = () => {
    // Stop highlight animation when user clicks
    setStore('onboarding', 'highlightGuideButton', false);
    setStore('onboarding', 'showTour', true);
  };

  const completeLanguageStep = () => {
    store.onboarding.completeStep?.(OnboardingStep.ChooseLanguage);
  };

  // Calculate onboarding progress for the circular indicator
  const onboardingProgress = createMemo(() => {
    const progress = store.onboarding?.progress;
    if (!progress) return { completed: 0, total: 1, percentage: 0 };

    const requiredSteps = ONBOARDING_STEPS.filter((step) => !step.optional);
    const completedCount = progress.completed_steps.filter((stepId) => {
      const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
      return step && !step.optional;
    }).length;

    return {
      completed: completedCount,
      total: requiredSteps.length,
      percentage: (completedCount / requiredSteps.length) * 100,
    };
  });

  const logout = async () => {
    // Log the user out
    const result = await authFetch(`${baseUrl}/sessions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (result.status === 200) {
      // Reset the user's session
      resetSession();
      navigate('/login');
    }
  };

  createEffect(async () => {
    if (triggerLogout()) {
      await logout();
    }
  });

  const onboardingLabel = () =>
    `${t('topbar.gettingStarted')} (${onboardingProgress().completed}/${onboardingProgress().total})`;

  return (
    <>
      <LoadingProgressBar loading={store.loadingAddons} />
      <GlobalShortcuts onShowShortcuts={() => setShowShortcuts(true)} />
      <Show when={showShortcutsUi()}>
        <ShortcutsLegend
          show={showShortcuts()}
          onClose={() => setShowShortcuts(false)}
        />
      </Show>
      <header
        class="castmill-header"
        classList={{ 'castmill-header--compact': compact() }}
      >
        <Show
          when={!searchOpen()}
          fallback={
            <div class="compact-search">
              <Search autoFocus onDone={() => setSearchOpen(false)} />
              <button
                type="button"
                class="topbar-icon-button"
                onClick={() => setSearchOpen(false)}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <TbX />
              </button>
            </div>
          }
        >
          <nav class="main">
            <Show when={checkAuth() && showMenuButton()}>
              <button
                type="button"
                class="topbar-icon-button topbar-menu-button"
                onClick={() => navDrawer.toggle()}
                aria-label={t('topbar.openNavigation')}
                title={t('topbar.openNavigation')}
                aria-controls={NAV_DRAWER_ID}
                aria-expanded={navDrawer.isOpen()}
                data-testid="topbar-menu-button"
              >
                <TbMenu2 />
              </button>
            </Show>
            <a
              href="/"
              class="network-logo"
              classList={{
                'network-logo--dark-backdrop': networkLogo().needsDarkBackdrop,
              }}
            >
              <img src={networkLogo().src} alt="Castmill" />
            </a>
            <Show when={selectedOrgLogo() && !compact()}>
              <div class="org-logo-separator" />
              <div class="org-logo-container">
                <img
                  src={selectedOrgLogo()!}
                  alt={store.organizations.selectedName}
                  class="org-logo"
                />
              </div>
            </Show>
          </nav>

          <nav class="right">
            <Show when={checkAuth()}>
              <Show
                when={!compact()}
                fallback={
                  <>
                    <button
                      type="button"
                      class="topbar-icon-button"
                      onClick={() => setSearchOpen(true)}
                      aria-label={t('common.search')}
                      title={t('common.search')}
                      data-testid="topbar-search-button"
                    >
                      <TbSearch />
                    </button>
                    <NotificationBell />
                    <TopbarOverflowMenu
                      onboardingLabel={onboardingLabel()}
                      highlight={store.onboarding?.highlightGuideButton}
                      onStartOnboarding={startOnboarding}
                      onLanguageChange={completeLanguageStep}
                      onShowShortcuts={
                        showShortcutsUi()
                          ? () => setShowShortcuts(true)
                          : undefined
                      }
                    />
                  </>
                }
              >
                <Search />

                <TopbarLink
                  to="https://docs.castmill.io"
                  icon={TbHelpCircle}
                  text={t('topbar.help')}
                  external={true}
                />

                <Show when={showShortcutsUi()}>
                  <div
                    class="keyboard-shortcuts-icon"
                    onClick={() => setShowShortcuts(true)}
                    title={t('shortcuts.showShortcutsLegend')}
                  >
                    <TbKeyboard />
                  </div>
                </Show>

                {/* Getting Started / Onboarding Tour Button with Progress Ring */}
                <div
                  class="getting-started-container"
                  classList={{
                    'animate-pulse': store.onboarding?.highlightGuideButton,
                  }}
                  data-onboarding="getting-started"
                  onClick={startOnboarding}
                  title={onboardingLabel()}
                >
                  {/* SVG Progress Ring */}
                  <svg class="progress-ring" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <circle
                      class="progress-ring__background"
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke-width="2"
                    />
                    {/* Progress circle */}
                    <circle
                      class="progress-ring__progress"
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke-width="2"
                      stroke-dasharray={`${onboardingProgress().percentage}, 100`}
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <div class="getting-started-icon">
                    <TbRocket />
                  </div>
                </div>

                {/* Light/dark mode toggle */}
                <ThemeToggle />

                {/* Notification Bell */}
                <NotificationBell />
              </Show>

              <div class="topbar-dropdowns">
                <Show when={!compact()}>
                  <LanguageSelector onLanguageChange={completeLanguageStep} />
                </Show>
                <div class="topbar-user-menu">
                  <DropdownMenu
                    ButtonComponent={(props) => (
                      <div {...props}>
                        <Show when={collapsedNav()} fallback={userLabel()}>
                          <span
                            class="user-avatar"
                            title={userLabel()}
                            aria-label={userLabel()}
                            data-testid="user-avatar"
                          >
                            {userInitial(userLabel())}
                          </span>
                        </Show>
                      </div>
                    )}
                  >
                    <A href="/settings">{t('common.settings')}</A>
                    <button
                      class="logout"
                      onClick={() => setTriggerLogout(true)}
                    >
                      {t('common.logout')}
                    </button>
                  </DropdownMenu>
                </div>
              </div>
            </Show>
          </nav>
        </Show>
      </header>
    </>
  );
};

export default Topbar;
