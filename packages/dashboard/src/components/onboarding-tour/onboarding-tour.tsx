import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { useI18n } from '../../i18n';
import { useToast } from '@castmill/ui-common';
import { OnboardingService } from '../../services/onboarding.service';
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
import { store } from '../../store/store';
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

  // Calculate current step based on progress
  onMount(() => {
    const completedSteps = progress().completed_steps;
    const nextStep = getNextStep(completedSteps);
    if (nextStep) {
      const stepIndex = ONBOARDING_STEPS.findIndex(
        (step) => step.id === nextStep
      );
      setCurrentStepIndex(stepIndex >= 0 ? stepIndex : 0);
    }
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
        toast.success(t('onboardingTour.stepCompleted'));
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
    if (step && step.targetPath && store.organizations.selectedId) {
      const path = step.targetPath.replace(
        ':orgId',
        store.organizations.selectedId
      );
      navigate(path);
      props.onClose();
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await OnboardingService.dismissTour(props.userId);
      toast.info(t('onboardingTour.dismissed'));
      props.onClose();
    } catch (error) {
      console.error('Failed to dismiss tour:', error);
      toast.error(t('onboardingTour.errors.failedToDismiss'));
    } finally {
      setLoading(false);
    }
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
              onClick={handleDismiss}
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
                <p>{t(currentStep().descriptionKey)}</p>

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
