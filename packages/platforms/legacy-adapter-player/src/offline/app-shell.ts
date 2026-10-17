export interface LegacyServiceWorkerConfig {
  scriptUrl: string;
  scope: string;
}

const isLocalDevelopmentOrigin = (location: Location): boolean =>
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const getLegacyServiceWorkerConfig = (
  location: Pick<Location, 'pathname'>
): LegacyServiceWorkerConfig => {
  if (
    location.pathname === '/legacy' ||
    location.pathname.startsWith('/legacy/')
  ) {
    return {
      scriptUrl: '/legacy/sw.js',
      scope: '/legacy',
    };
  }

  return {
    scriptUrl: '/sw.js',
    scope: '/',
  };
};

export const registerLegacyAppShell = async (
  browserNavigator: Navigator = navigator,
  location: Location = window.location,
  secureContext: boolean = window.isSecureContext === true ||
    window.location.protocol === 'https:'
): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in browserNavigator)) {
    console.warn(
      '[LegacyAppShell] Service workers are unavailable; offline startup is disabled.'
    );
    return;
  }

  if (!secureContext && !isLocalDevelopmentOrigin(location)) {
    console.error(
      '[LegacyAppShell] A secure HTTPS origin is required for offline startup.'
    );
    return;
  }

  const { scriptUrl, scope } = getLegacyServiceWorkerConfig(location);

  try {
    return await browserNavigator.serviceWorker.register(scriptUrl, { scope });
  } catch (error) {
    console.error(
      '[LegacyAppShell] Failed to install the offline application shell.',
      error
    );
  }
};
