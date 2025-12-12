import { Component, createSignal } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Button, useToast } from '@castmill/ui-common';
import { DevicesService } from '../services/devices.service';
import { BsPlayFill } from 'solid-icons/bs';
import { AddonStore } from '../../common/interfaces/addon-store';

export const RemoteControl: Component<{
  baseUrl: string;
  device: Device;
  organizationId: string;
  store?: AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const formatDate =
    props.store?.i18n?.formatDate || ((date: Date) => date.toLocaleString());
  const toast = useToast();

  const [resolution, setResolution] = createSignal('auto');
  const [fps, setFps] = createSignal('auto');
  const [isStarting, setIsStarting] = createSignal(false);

  // RC app is considered available if heartbeat was within last 60 seconds
  const isRcAppAvailable = () => {
    if (!props.device.rc_last_heartbeat) return false;
    const lastHeartbeat = new Date(props.device.rc_last_heartbeat);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;
    return diffSeconds < 60; // 60 second timeout
  };

  const resolutionOptions = [
    { value: 'auto', label: t('devices.remoteControl.auto') },
    { value: '480p', label: '480p' },
    { value: '720p', label: '720p' },
  ];

  const fpsOptions = [
    { value: 'auto', label: t('devices.remoteControl.auto') },
    { value: '10', label: '10 FPS' },
    { value: '15', label: '15 FPS' },
    { value: '30', label: '30 FPS' },
  ];

  const getPlayerStatusText = () => {
    if (props.device.online) {
      return t('devices.remoteControl.online');
    }
    return t('devices.remoteControl.offline');
  };

  const getPlayerStatusColor = () => {
    return props.device.online ? '#4ade80' : '#f87171';
  };

  const getRcAppStatusText = () => {
    if (isRcAppAvailable()) {
      return t('devices.remoteControl.rcAppAvailable');
    }
    return t('devices.remoteControl.rcAppUnavailable');
  };

  const getRcAppStatusColor = () => {
    return isRcAppAvailable() ? '#4ade80' : '#f87171';
  };

  const getLastRcHeartbeat = () => {
    if (!props.device.rc_last_heartbeat) {
      return t('devices.remoteControl.never');
    }
    if (isRcAppAvailable()) {
      return t('devices.remoteControl.now');
    }
    return formatDate(new Date(props.device.rc_last_heartbeat));
  };

  const getLastCheckIn = () => {
    if (props.device.online) {
      return t('devices.remoteControl.now');
    }
    return formatDate(new Date(props.device.last_online));
  };

  const handleStartSession = async () => {
    if (!isRcAppAvailable()) {
      toast.error(t('devices.remoteControl.rcAppNotAvailableError'));
      return;
    }

    setIsStarting(true);
    try {
      const fpsValue = fps() === 'auto' ? 0 : parseInt(fps());
      const result = await DevicesService.startRemoteControlSession(
        props.baseUrl,
        props.device.id,
        resolution(),
        fpsValue
      );

      // Open RC window in popup
      const rcUrl = `/org/${props.organizationId}/devices/${props.device.id}/remote-control?session=${result.session_id}`;
      const width = 1024;
      const height = 768;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        rcUrl,
        'RemoteControl',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
      );

      toast.success(t('devices.remoteControl.sessionStarted'));
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      toast.error(
        t('devices.remoteControl.sessionStartError', { error: errorMsg })
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div style="display: flex; flex-direction: column; gap: 1.5em;">
      {/* Status Section */}
      <div style="border: 1px solid #e5e7eb; border-radius: 0.5em; padding: 1.5em;">
        <h3 style="margin-top: 0; margin-bottom: 1em; font-size: 1.1em;">
          {t('devices.remoteControl.status')}
        </h3>
        
        <div style="display: flex; flex-direction: column; gap: 1em;">
          {/* RC App Status */}
          <div>
            <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 0.25em;">
              {t('devices.remoteControl.rcAppStatus')}
            </div>
            <div style="display: flex; align-items: center; gap: 0.5em;">
              <span
                style={{
                  display: 'inline-block',
                  width: '0.75em',
                  height: '0.75em',
                  'border-radius': '50%',
                  'background-color': getRcAppStatusColor(),
                }}
              />
              <span style="font-weight: 600;">{getRcAppStatusText()}</span>
            </div>
          </div>

          <div>
            <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 0.25em;">
              {t('devices.remoteControl.lastRcHeartbeat')}
            </div>
            <div>{getLastRcHeartbeat()}</div>
          </div>

          {/* Player Status (informational) */}
          <div>
            <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 0.25em;">
              {t('devices.remoteControl.playerStatus')}
            </div>
            <div style="display: flex; align-items: center; gap: 0.5em;">
              <span
                style={{
                  display: 'inline-block',
                  width: '0.75em',
                  height: '0.75em',
                  'border-radius': '50%',
                  'background-color': getPlayerStatusColor(),
                }}
              />
              <span>{getPlayerStatusText()}</span>
            </div>
          </div>

          <div>
            <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 0.25em;">
              {t('devices.remoteControl.activeSession')}
            </div>
            <div>{t('common.no')}</div>
          </div>
        </div>
      </div>

      {/* Session Settings Section */}
      <div style="border: 1px solid #e5e7eb; border-radius: 0.5em; padding: 1.5em;">
        <h3 style="margin-top: 0; margin-bottom: 1em; font-size: 1.1em;">
          {t('devices.remoteControl.sessionSettings')}
        </h3>

        <div style="display: flex; flex-direction: column; gap: 1em;">
          <div>
            <label
              for="resolution"
              style="display: block; margin-bottom: 0.5em; font-weight: 500;"
            >
              {t('devices.remoteControl.resolution')}
            </label>
            <select
              id="resolution"
              value={resolution()}
              onInput={(e) => setResolution(e.currentTarget.value)}
              style="width: 100%; padding: 0.5em; border: 1px solid #d1d5db; border-radius: 0.375em; font-size: 1em;"
            >
              {resolutionOptions.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label
              for="fps"
              style="display: block; margin-bottom: 0.5em; font-weight: 500;"
            >
              {t('devices.remoteControl.fps')}
            </label>
            <select
              id="fps"
              value={fps()}
              onInput={(e) => setFps(e.currentTarget.value)}
              style="width: 100%; padding: 0.5em; border: 1px solid #d1d5db; border-radius: 0.375em; font-size: 1em;"
            >
              {fpsOptions.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div style="margin-top: 1em;">
            <Button
              label={t('devices.remoteControl.startSession')}
              onClick={handleStartSession}
              disabled={isStarting() || !isRcAppAvailable()}
              icon={BsPlayFill}
              color="primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
