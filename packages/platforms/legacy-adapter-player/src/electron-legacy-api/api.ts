// Description: This file contains the functions that are used to communicate with
// the legacy Electron app.

interface EnvironmentData {
  model: string;
  deviceId: string;
  versionStr: string;
}

/**
 * Get the environment data from the legacy app.
 * Posts a message to the parent window and waits for a response, which
 * is expected to be a JSON object with the following properties:
 * - deviceId: string
 * - versionStr: string
 * - model: string
 */
export async function getEnvironment(): Promise<EnvironmentData> {
  if (parent === window) {
    throw new Error('getEnvironment can only be called from an iframe');
  }

  return new Promise((resolve, reject) => {
    const responseHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const deviceId = data.deviceId;
        const versionStr = data.versionStr;
        const model = data.model;

        if (!deviceId || !versionStr || !model) {
          throw new Error('Invalid environment data: ' + event.data);
        }

        resolve({
          deviceId,
          versionStr,
          model,
        });
      } catch (err) {
        reject(err);
      }
    };

    window.addEventListener('message', responseHandler, { once: true });

    parent.postMessage('getEnvironment', '*');
  });
}

export function reboot() {
  parent.postMessage('reboot', '*');
}

export function restart() {
  parent.postMessage('restart', '*');
}

export function updatePlayer() {
  parent.postMessage('updatePlayer', '*');
}

export function clearStorage() {
  parent.postMessage('clearStorage', '*');
}

export function sendHeartbeat() {
  parent.postMessage('alive', '*');
}

export function sendPlayerReady() {
  parent.postMessage('player_ready', '*');
}
