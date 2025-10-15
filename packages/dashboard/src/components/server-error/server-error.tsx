import { Component } from 'solid-js';
import { useI18n } from '../../i18n';
import './server-error.css';

interface ServerErrorProps {
  onRetry?: () => void;
}

export const ServerError: Component<ServerErrorProps> = (props) => {
  const { t } = useI18n();

  return (
    <div class="server-error-container">
      <div class="server-error-content">
        <div class="server-error-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="M12 7v4" />
            <path d="M12 15h.01" />
          </svg>
        </div>
        <h1 class="server-error-title">{t('errors.serverUnreachable')}</h1>
        <p class="server-error-description">
          {t('errors.serverUnreachableDescription')}
        </p>
        <ul class="server-error-suggestions">
          <li>{t('errors.checkServerRunning')}</li>
          <li>{t('errors.checkNetworkConnection')}</li>
          <li>{t('errors.checkServerUrl')}</li>
        </ul>
        {props.onRetry && (
          <button class="server-error-retry-button" onClick={props.onRetry}>
            {t('errors.retryConnection')}
          </button>
        )}
      </div>
    </div>
  );
};
