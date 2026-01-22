import {
  Component,
  Show,
  createEffect,
  createSignal,
  createMemo,
} from 'solid-js';
import './topbar.scss';

import { checkAuth, getUser, resetSession } from '../auth';
import { useNavigate } from '@solidjs/router';
import TopbarLink from '../topbar-link/topbar-link';
import Search from '../search/search';

// Find any icon here: https://solid-icons.vercel.app/search/settings
import { FaRegularBell } from 'solid-icons/fa';
import { TbHelpCircle, TbKeyboard, TbRocket } from 'solid-icons/tb';

import logo from '../../assets/castmill-logo-topbar.png';
import DropdownMenu from '../dropdown-menu/dropdown-menu';
import LanguageSelector from '../language-selector/language-selector';
import { LoadingProgressBar } from '../loading-progress-bar/loading-progress-bar';
import NotificationBell from '../notification-bell/notification-bell';

import { baseUrl } from '../../env';
import { useI18n } from '../../i18n';
import { store, setStore } from '../../store/store';
import { ShortcutsLegend } from '../shortcuts-legend/shortcuts-legend';
import { GlobalShortcuts } from '../global-shortcuts/global-shortcuts';
import { useSelectedOrganizationLogo } from '../../hooks/use-selected-organization-logo';
import { OnboardingStep } from '../../interfaces/onboarding-progress.interface';
import { ONBOARDING_STEPS } from '../../config/onboarding-steps';

const Topbar: Component = () => {
  const [triggerLogout, setTriggerLogout] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const { t } = useI18n();
  const { logoUrl: selectedOrgLogo } = useSelectedOrganizationLogo();

  const navigate = useNavigate();

  // Calculate onboarding progress for the circular indicator
  const onboardingProgress = createMemo(() => {
    const progress = store.onboarding.progress;
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
    const result = await fetch(`${baseUrl}/sessions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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

  return (
    <>
      <LoadingProgressBar loading={store.loadingAddons} />
      <GlobalShortcuts onShowShortcuts={() => setShowShortcuts(true)} />
      <ShortcutsLegend
        show={showShortcuts()}
        onClose={() => setShowShortcuts(false)}
      />
      <header class="castmill-header">
        <nav class="main">
          <a href="/">
            <img src={logo} alt="Castmill" />
          </a>
          <Show when={selectedOrgLogo()}>
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
            <Search />

            <TopbarLink
              to="https://docs.castmill.io"
              icon={TbHelpCircle}
              text={t('topbar.help')}
              external={true}
            />

            <Show
              when={
                !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                  navigator.userAgent
                )
              }
            >
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
                'animate-pulse': store.onboarding.highlightGuideButton,
              }}
              data-onboarding="getting-started"
              onClick={() => {
                // Stop highlight animation when user clicks
                setStore('onboarding', 'highlightGuideButton', false);
                setStore('onboarding', 'showTour', true);
              }}
              title={`${t('topbar.gettingStarted')} (${onboardingProgress().completed}/${onboardingProgress().total})`}
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

            {/* Notification Bell */}
            <NotificationBell />

            <div class="topbar-dropdowns">
              <LanguageSelector
                onLanguageChange={() => {
                  store.onboarding.completeStep?.(
                    OnboardingStep.ChooseLanguage
                  );
                }}
              />
              <DropdownMenu
                ButtonComponent={(props) => (
                  <div {...props}>{getUser().name || getUser().email}</div>
                )}
              >
                <a href="/profile">{t('common.profile')}</a>
                <a href="/settings">{t('common.settings')}</a>
                <button class="logout" onClick={() => setTriggerLogout(true)}>
                  {t('common.logout')}
                </button>
              </DropdownMenu>
            </div>
          </Show>
        </nav>
      </header>
    </>
  );
};

export default Topbar;
