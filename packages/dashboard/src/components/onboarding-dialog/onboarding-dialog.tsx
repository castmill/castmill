import { Component, createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useI18n } from '../../i18n';
import { useToast } from '@castmill/ui-common';
import { OrganizationsService } from '../../services/organizations.service';
import './onboarding-dialog.scss';

interface OnboardingDialogProps {
  organizationId: string;
  onComplete: (organizationName: string) => void;
}

export const OnboardingDialog: Component<OnboardingDialogProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();
  const [organizationName, setOrganizationName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const name = organizationName().trim();
    
    if (!name) {
      setError(t('onboarding.errors.organizationNameRequired'));
      return;
    }

    if (name.length < 2) {
      setError(t('onboarding.errors.organizationNameTooShort'));
      return;
    }

    if (name.length > 50) {
      setError(t('onboarding.errors.organizationNameTooLong'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await OrganizationsService.completeOnboarding(
        props.organizationId,
        name
      );
      toast.success(t('onboarding.success'));
      props.onComplete(name);
    } catch (err) {
      if (err instanceof Error) {
        // Check if it's a duplicate name error
        if (err.message.includes('has already been taken')) {
          setError(t('onboarding.errors.organizationNameTaken'));
        } else {
          setError(t('onboarding.errors.failed'));
        }
      } else {
        setError(t('onboarding.errors.failed'));
      }
      console.error('Failed to complete onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setOrganizationName(target.value);
    setError('');
  };

  return (
    <Portal>
      <div class="onboarding-dialog-overlay">
        <div class="onboarding-dialog">
          <div class="onboarding-dialog-header">
            <h2>{t('onboarding.title')}</h2>
            <p class="onboarding-dialog-subtitle">
              {t('onboarding.subtitle')}
            </p>
          </div>

          <form class="onboarding-dialog-form" onSubmit={handleSubmit}>
            <div class="onboarding-dialog-content">
              <label for="organization-name" class="onboarding-dialog-label">
                {t('onboarding.organizationNameLabel')}
              </label>
              <input
                id="organization-name"
                type="text"
                class="onboarding-dialog-input"
                value={organizationName()}
                onInput={handleInputChange}
                placeholder={t('onboarding.organizationNamePlaceholder')}
                disabled={loading()}
                autofocus
              />
              <Show when={error()}>
                <div class="onboarding-dialog-error">{error()}</div>
              </Show>
              <p class="onboarding-dialog-help">
                {t('onboarding.helpText')}
              </p>
            </div>

            <div class="onboarding-dialog-footer">
              <button
                type="submit"
                class="onboarding-dialog-button"
                disabled={loading() || !organizationName().trim()}
              >
                <Show when={loading()} fallback={t('onboarding.continueButton')}>
                  {t('common.loading')}
                </Show>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
