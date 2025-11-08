import { Component, createSignal } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Button, FormItem, useToast } from '@castmill/ui-common';
import { DevicesService } from '../services/devices.service';
import { BsPlayFill } from 'solid-icons/bs';

export const RemoteControl: Component<{
  baseUrl: string;
  device: Device;
  organizationId: string;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [resolution, setResolution] = createSignal('auto');
  const [fps, setFps] = createSignal('auto');
  const [isStarting, setIsStarting] = createSignal(false);

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

  const getStatusText = () => {
    if (props.device.online) {
      return t('devices.remoteControl.online');
    }
    return t('devices.remoteControl.offline');
  };

  const getStatusColor = () => {
    return props.device.online ? '#4ade80' : '#f87171';
  };

  const getLastCheckIn = () => {
    if (props.device.online) {
      return t('devices.remoteControl.now');
    }
    return new Date(props.device.last_online).toLocaleString();
  };

  const handleStartSession = async () => {
    if (!props.device.online) {
      toast.error(t('devices.remoteControl.deviceOfflineError'));
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
          <div style="display: flex; align-items: center; gap: 0.5em;">
            <span
              style={{
                display: 'inline-block',
                width: '0.75em',
                height: '0.75em',
                'border-radius': '50%',
                'background-color': getStatusColor(),
              }}
            />
            <span style="font-weight: 600;">{getStatusText()}</span>
          </div>

          <div>
            <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 0.25em;">
              {t('devices.remoteControl.lastCheckIn')}
            </div>
            <div>{getLastCheckIn()}</div>
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
              disabled={isStarting() || !props.device.online}
              icon={BsPlayFill}
              color="primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
