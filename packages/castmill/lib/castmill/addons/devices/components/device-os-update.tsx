import { Component, For, Show, createResource, createSignal } from 'solid-js';
import {
  Button,
  Dropdown,
  SectionCard,
  Switch,
  formatTimestamp,
  useToast,
} from '@castmill/ui-common';
import {
  Device,
  OsRelease,
  OsUpdateOverride,
  OsUpdatePolicy,
} from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

type T = (key: string, params?: Record<string, any>) => string;

const STATE_KEYS: Record<string, string> = {
  idle: 'devices.osUpdate.state.idle',
  installing: 'devices.osUpdate.state.installing',
  installed: 'devices.osUpdate.state.installed',
  activating: 'devices.osUpdate.state.activating',
  running: 'devices.osUpdate.state.running',
  rolled_back: 'devices.osUpdate.state.rolledBack',
  failed: 'devices.osUpdate.state.failed',
  unsupported: 'devices.osUpdate.state.unsupported',
};

/**
 * Castmill OS updates of one device: what it runs and how far an update got,
 * its override of the organization policy, and the organization policy
 * (castmill-os ADR-0010).
 */
export const DeviceOsUpdate: Component<{
  baseUrl: string;
  organizationId: string;
  device: Device;
  /** Called with the saved override (the live channel may not deliver it). */
  onChange?: (update: Partial<Device>) => void;
  t: T;
}> = (props) => {
  const toast = useToast();
  const [data, { mutate }] = createResource(
    () => props.organizationId,
    (orgId) => DevicesService.getOsUpdates(props.baseUrl, orgId)
  );
  const [saving, setSaving] = createSignal(false);

  const status = () => props.device.os_status;
  const override = (): OsUpdateOverride =>
    props.device.os_update ?? { mode: 'follow' };
  // All releases (the organization policy covers every kind of device) and
  // those with a bundle for this device's hardware (the device override).
  const allReleases = (): OsRelease[] => data()?.releases ?? [];
  const releases = (): OsRelease[] => {
    const compatible = status()?.compatible;
    return allReleases().filter(
      (r) => !compatible || compatible in r.artifacts
    );
  };
  const toItems = (list: OsRelease[]) =>
    list.map((r) => ({
      value: r.version,
      name: r.prerelease
        ? props.t('devices.osUpdate.prerelease', { version: r.version })
        : r.version,
    }));
  const releaseItems = () => toItems(releases());

  const stateLabel = () => {
    const s = status();
    if (!s) return props.t('common.notAvailable');
    const label = props.t(STATE_KEYS[s.state] ?? s.state, {
      version: s.version ?? '',
    });
    return s.state === 'installing' && typeof s.progress === 'number'
      ? `${label} (${s.progress} %)`
      : label;
  };

  const save = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      toast.success(props.t('devices.osUpdate.saved'));
    } catch (error) {
      toast.error(
        props.t('devices.osUpdate.saveFailed', { error: String(error) })
      );
    } finally {
      setSaving(false);
    }
  };

  const setOverride = (next: OsUpdateOverride) =>
    save(async () => {
      const { os_update } = await DevicesService.setDeviceOsUpdate(
        props.baseUrl,
        props.device.id,
        next
      );
      props.onChange?.({ os_update });
    });

  const setPolicy = (next: OsUpdatePolicy) =>
    save(async () => {
      const { policy } = await DevicesService.setOsUpdatePolicy(
        props.baseUrl,
        props.organizationId,
        next
      );
      const current = data();
      if (current) mutate({ ...current, policy });
    });

  const policy = (): OsUpdatePolicy =>
    data()?.policy ?? { mode: 'manual', prereleases: false };

  return (
    <div class="device-os-update">
      <SectionCard title={props.t('devices.osUpdate.thisDevice')}>
        <dl class="device-info-list">
          <div class="device-info-item">
            <dt>{props.t('devices.osUpdate.currentVersion')}</dt>
            <dd>
              {status()?.current_version ?? props.t('common.notAvailable')}
            </dd>
          </div>
          <div
            class="device-info-item"
            classList={{
              warning: ['failed', 'rolled_back'].includes(
                status()?.state ?? ''
              ),
            }}
            data-field="os-update-state"
          >
            <dt>{props.t('devices.osUpdate.status')}</dt>
            <dd>{stateLabel()}</dd>
          </div>
          <div class="device-info-item">
            <dt>{props.t('devices.osUpdate.targetVersion')}</dt>
            <dd>
              {status()?.target_version || props.t('devices.osUpdate.none')}
            </dd>
          </div>
          <div class="device-info-item">
            <dt>{props.t('devices.osUpdate.hardwareFamily')}</dt>
            <dd>{status()?.compatible ?? props.t('common.notAvailable')}</dd>
          </div>
          <Show when={status()?.last_error}>
            <div class="device-info-item wide warning">
              <dt>{props.t('devices.osUpdate.lastError')}</dt>
              <dd>{status()?.last_error}</dd>
            </div>
          </Show>
          <Show when={status()?.received_at}>
            <div class="device-info-item">
              <dt>{props.t('devices.osUpdate.reportedAt')}</dt>
              <dd>{formatTimestamp(status()!.received_at!)}</dd>
            </div>
          </Show>
        </dl>

        <div class="device-os-update-controls">
          <Dropdown
            id="os-update-override"
            label={props.t('devices.osUpdate.version')}
            value={
              override().mode === 'version'
                ? (override().version ?? null)
                : 'follow'
            }
            items={[
              {
                value: 'follow',
                name: props.t('devices.osUpdate.followOrganization'),
              },
              ...releaseItems(),
            ]}
            onSelectChange={(value) =>
              setOverride(
                !value || value === 'follow'
                  ? { mode: 'follow' }
                  : { mode: 'version', version: value, now: false }
              )
            }
          />
          <Show when={override().mode === 'version' && !override().now}>
            <Button
              label={props.t('devices.osUpdate.updateNow')}
              color="primary"
              disabled={saving()}
              onClick={() => setOverride({ ...override(), now: true })}
            />
          </Show>
        </div>
      </SectionCard>

      <SectionCard title={props.t('devices.osUpdate.organization')}>
        <p class="device-os-update-help">
          {props.t('devices.osUpdate.organizationHelp')}
        </p>
        <div class="device-os-update-controls">
          <Dropdown
            id="os-update-policy"
            label={props.t('devices.osUpdate.policy')}
            value={
              policy().mode === 'version'
                ? (policy().version ?? null)
                : policy().mode
            }
            items={[
              {
                value: 'manual',
                name: props.t('devices.osUpdate.policyManual'),
              },
              {
                value: 'latest',
                name: props.t('devices.osUpdate.policyLatest'),
              },
              ...toItems(allReleases()).map((item) => ({
                ...item,
                name: props.t('devices.osUpdate.policyVersion', {
                  version: item.name,
                }),
              })),
            ]}
            onSelectChange={(value) => {
              if (!value) return;
              setPolicy(
                value === 'manual' || value === 'latest'
                  ? { ...policy(), mode: value, version: null }
                  : { ...policy(), mode: 'version', version: value }
              );
            }}
          />
          <Switch
            name={props.t('devices.osUpdate.includePrereleases')}
            key="prereleases"
            isActive={policy().prereleases}
            disabled={saving() || policy().mode !== 'latest'}
            onToggle={() =>
              setPolicy({ ...policy(), prereleases: !policy().prereleases })
            }
          />
        </div>
        <Show when={releases().length === 0 && !data.loading}>
          <p class="device-os-update-help">
            {props.t('devices.osUpdate.noReleases')}
          </p>
        </Show>
        <ul class="device-os-update-releases">
          <For each={releases().slice(0, 5)}>
            {(release) => (
              <li>
                <Show when={release.notes_url} fallback={release.version}>
                  <a
                    href={release.notes_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {release.version}
                  </a>
                </Show>{' '}
                · {formatTimestamp(release.published_at)}
                <Show when={release.prerelease}>
                  {' '}
                  · {props.t('devices.osUpdate.prereleaseTag')}
                </Show>
                <Show when={release.security}>
                  {' '}
                  · {props.t('devices.osUpdate.securityTag')}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </SectionCard>
    </div>
  );
};
