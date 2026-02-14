import {
  Component,
  createSignal,
  createEffect,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { useI18n } from '../../i18n';
import { ConfirmDialog, useToast } from '@castmill/ui-common';
import { RiSystemExternalLinkLine } from 'solid-icons/ri';
import { OnboardingService } from '../../services/onboarding.service';
import { baseUrl } from '../../env';
import {
  OnboardingStep,
  OnboardingProgress,
} from '../../interfaces/onboarding-progress.interface';
import {
  ONBOARDING_STEPS,
  getNextStep,
  getStepConfig,
  isOnboardingComplete,
} from '../../config/onboarding-steps';
import { store, setStore } from '../../store/store';
import './onboarding-tour.scss';

interface OnboardingTourProps {
  userId: string;
  initialProgress: OnboardingProgress;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingTour: Component<OnboardingTourProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [progress, setProgress] = createSignal<OnboardingProgress>(
    props.initialProgress
  );
  const [currentStepIndex, setCurrentStepIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [showDismissConfirm, setShowDismissConfirm] = createSignal(false);

  const dismissNoticeKey = 'castmill.onboarding.dismissedNoticeShown';

  const shouldShowDismissConfirm = () => {
    try {
      return !localStorage.getItem(dismissNoticeKey);
    } catch {
      return true;
    }
  };

  const resolvePlayerUrl = () => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return baseUrl;
    }
  };

  const stepDescription = () => {
    const step = currentStep();
    if (!step) return '';
    if (step.id === OnboardingStep.RegisterDevice) {
      return t(step.descriptionKey, {
        playerUrl: resolvePlayerUrl(),
      });
    }
    return t(step.descriptionKey);
  };

  // Restore the last-viewed step on re-open, or fall back to the next
  // incomplete step on first open.
  onMount(() => {
    if (store.onboarding.lastStepIndex !== undefined) {
      setCurrentStepIndex(store.onboarding.lastStepIndex);
    } else {
      const completedSteps = progress().completed_steps;
      const nextStep = getNextStep(completedSteps);
      if (nextStep) {
        const stepIndex = ONBOARDING_STEPS.findIndex(
          (step) => step.id === nextStep
        );
        setCurrentStepIndex(stepIndex >= 0 ? stepIndex : 0);
      }
    }
  });

  // Keep the store in sync so the position survives close / reopen.
  createEffect(() => {
    setStore('onboarding', 'lastStepIndex', currentStepIndex());
  });

  const currentStep = () => ONBOARDING_STEPS[currentStepIndex()];
  const totalSteps = () => ONBOARDING_STEPS.filter((s) => !s.optional).length;
  const completedCount = () => {
    return progress().completed_steps.filter((stepId) => {
      const step = getStepConfig(stepId);
      return step && !step.optional;
    }).length;
  };

  const isStepCompleted = (stepId: OnboardingStep) => {
    return progress().completed_steps.includes(stepId);
  };

  const handleNext = () => {
    if (currentStepIndex() < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex() > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleCompleteStep = async () => {
    const step = currentStep();
    if (!step) return;

    setLoading(true);
    try {
      const updatedProgress = await OnboardingService.completeStep(
        props.userId,
        step.id
      );
      setProgress(updatedProgress);

      // Check if all steps are complete
      if (isOnboardingComplete(updatedProgress.completed_steps)) {
        toast.success(t('onboardingTour.allStepsComplete'));
        props.onComplete();
      } else {
        handleNext();
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
      toast.error(t('onboardingTour.errors.failedToCompleteStep'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoToAction = () => {
    const step = currentStep();
    if (!step) return;

    // Special handling for FindGuide step - highlight the button with animation
    if (step.id === OnboardingStep.FindGuide) {
      // Close the tour and show the pulsing animation on the guide button
      props.onClose();
      setStore('onboarding', 'highlightGuideButton', true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // After showing the animation, stop it and reopen the guide
      setTimeout(() => {
        setStore('onboarding', 'highlightGuideButton', false);
        setStore('onboarding', 'showTour', true);
      }, 3000);
      return;
    }

    // If there's a targetPath, navigate to it
    if (step.targetPath && store.organizations.selectedId) {
      const path = step.targetPath.replace(
        ':orgId',
        store.organizations.selectedId
      );

      // If there's also a targetSelector, add highlight param to URL
      // so the target page can highlight the element
      if (step.targetSelector) {
        const separator = path.includes('?') ? '&' : '?';
        const highlightPath = `${path}${separator}highlight=${encodeURIComponent(step.targetSelector)}`;
        navigate(highlightPath);
      } else {
        navigate(path);
      }
      props.onClose();
    } else if (step.targetSelector) {
      // If there's only a targetSelector (no path), close the tour first
      // so the user can interact with the element (e.g., language dropdown)
      props.onClose();

      // Enable highlight animation on the guide button
      setStore('onboarding', 'highlightGuideButton', true);

      // Use setTimeout to allow the overlay to close before triggering the click
      setTimeout(() => {
        const element = document.querySelector(step.targetSelector!);
        if (element) {
          // Scroll to element if needed
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // For dropdown menus, the click handler is on the parent .button-container
          // Try to find and click that, otherwise click the element itself
          const buttonContainer =
            element.closest('.button-container') || element;
          (buttonContainer as HTMLElement).click?.();
        }
      }, 100);

      // After a delay for user interaction, stop animation and reopen the guide
      setTimeout(() => {
        setStore('onboarding', 'highlightGuideButton', false);
        setStore('onboarding', 'showTour', true);
      }, 3000);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await OnboardingService.dismissTour(props.userId);
      props.onClose();
      try {
        localStorage.setItem(dismissNoticeKey, 'true');
      } catch {
        // ignore storage errors
      }
    } catch (error) {
      console.error('Failed to dismiss tour:', error);
      toast.error(t('onboardingTour.errors.failedToDismiss'));
    } finally {
      setLoading(false);
    }
  };

  const handleDismissRequest = () => {
    if (shouldShowDismissConfirm()) {
      setShowDismissConfirm(true);
      return;
    }
    void handleDismiss();
  };

  const handleSkip = () => {
    handleNext();
  };

  // Handle ESC key to close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDismiss();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Portal>
      <div class="onboarding-tour-overlay">
        <ConfirmDialog
          show={showDismissConfirm()}
          title={t('onboardingTour.dismissConfirmTitle')}
          message={t('onboardingTour.dismissConfirmMessage')}
          onClose={() => setShowDismissConfirm(false)}
          onConfirm={() => {
            setShowDismissConfirm(false);
            void handleDismiss();
          }}
        />
        <div class="onboarding-tour">
          <div class="onboarding-tour-header">
            <div class="onboarding-tour-title-section">
              <h2>{t('onboardingTour.title')}</h2>
              <div class="onboarding-tour-progress-text">
                {t('onboardingTour.progressText', {
                  current: completedCount(),
                  total: totalSteps(),
                })}
              </div>
            </div>
            <button
              class="onboarding-tour-close"
              onClick={handleDismissRequest}
              disabled={loading()}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>

          <div class="onboarding-tour-progress-bar">
            <div
              class="onboarding-tour-progress-fill"
              style={{
                width: `${(completedCount() / totalSteps()) * 100}%`,
              }}
            />
          </div>

          <div class="onboarding-tour-content">
            <Show when={currentStep()}>
              <div class="onboarding-tour-step">
                <div class="onboarding-tour-step-number">
                  <Show
                    when={isStepCompleted(currentStep().id)}
                    fallback={
                      <span class="step-number">{currentStepIndex() + 1}</span>
                    }
                  >
                    <span class="step-checkmark">✓</span>
                  </Show>
                </div>
                <h3>{t(currentStep().titleKey)}</h3>
                <p>{stepDescription()}</p>

                <Show when={currentStep().docsUrl}>
                  <a
                    href={currentStep().docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="onboarding-tour-docs-link"
                  >
                    {t('onboardingTour.learnMore')}
                    <RiSystemExternalLinkLine class="onboarding-tour-link-icon" />
                  </a>
                </Show>

                <Show when={!isStepCompleted(currentStep().id)}>
                  <div class="onboarding-tour-actions">
                    <button
                      class="onboarding-tour-action-button primary"
                      onClick={handleGoToAction}
                      disabled={loading()}
                    >
                      {t(currentStep().actionKey)}
                    </button>
                    <button
                      class="onboarding-tour-action-button secondary"
                      onClick={handleCompleteStep}
                      disabled={loading()}
                    >
                      {t('onboardingTour.markComplete')}
                    </button>
                  </div>
                </Show>

                <Show when={isStepCompleted(currentStep().id)}>
                  <div class="onboarding-tour-completed-badge">
                    <span>✓ {t('onboardingTour.stepCompletedBadge')}</span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          <div class="onboarding-tour-footer">
            <button
              class="onboarding-tour-nav-button"
              onClick={handlePrevious}
              disabled={currentStepIndex() === 0 || loading()}
            >
              ← {t('common.back')}
            </button>

            <div class="onboarding-tour-dots">
              {ONBOARDING_STEPS.map((step, index) => (
                <button
                  class={`onboarding-tour-dot ${
                    index === currentStepIndex() ? 'active' : ''
                  } ${isStepCompleted(step.id) ? 'completed' : ''}`}
                  onClick={() => setCurrentStepIndex(index)}
                  disabled={loading()}
                  aria-label={t('onboardingTour.goToStep', { step: index + 1 })}
                />
              ))}
            </div>

            <Show
              when={currentStepIndex() < ONBOARDING_STEPS.length - 1}
              fallback={
                <button
                  class="onboarding-tour-nav-button"
                  onClick={handleDismiss}
                  disabled={loading()}
                >
                  {t('onboardingTour.finish')}
                </button>
              }
            >
              <button
                class="onboarding-tour-nav-button"
                onClick={handleSkip}
                disabled={loading()}
              >
                {t('onboardingTour.skip')} →
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Portal>
  );
};
