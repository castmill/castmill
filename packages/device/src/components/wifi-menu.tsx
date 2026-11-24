import { createResource, createSignal, type Accessor } from 'solid-js';

import type { Device } from '../classes/device';
import type { WifiNetwork } from '../interfaces/machine';
import type { MenuEntry } from './basemenu.component';

type ConnectState =
  | { kind: 'connecting'; ssid: string }
  | { kind: 'connected'; ssid: string }
  | { kind: 'error'; ssid: string; message: string };

interface PendingNetwork {
  ssid: string;
  hidden: boolean;
}

/** The platform's reason, without Electron's IPC wrapping. */
export const wifiErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw
    .replace(/^Error invoking remote method '[^']+': /, '')
    .replace(/^Error: /, '')
    .trim();
  return message || 'Could not join the network.';
};

const networkLabel = (n: WifiNetwork) =>
  `${n.ssid} · ${n.signal}%${n.secure ? '' : ' · open'}`;

// Row ids follow the network, not its place in the scan: the menu keeps the
// selection and typed passwords by id, and a scan can reorder the networks.
const networkId = (ssid: string) => `wifi-network:${ssid}`;
const passwordId = (ssid: string, hidden: boolean) =>
  `wifi-password:${hidden ? 'hidden' : 'visible'}:${ssid}`;

const info = (id: string, text: string): MenuEntry => ({
  id,
  type: 'info',
  content: <span>{text}</span>,
});

/**
 * The "Wi-Fi" entry of the device menu, on platforms that report Wi-Fi
 * (Castmill OS). Shows the current network; while the device is offline it
 * lists the networks in range and joins one. Platforms refuse changes while
 * the device is online, and the menu says so instead of offering them.
 */
export function createWifiMenu(device: Device): {
  entry: Accessor<MenuEntry | undefined>;
  refresh: () => void;
} {
  const [status, { refetch }] = createResource(
    () => device,
    (d) => d.getWifiStatus()
  );
  const [pending, setPending] = createSignal<PendingNetwork | null>(null);
  const [askName, setAskName] = createSignal(false);
  const [state, setState] = createSignal<ConnectState | null>(null);

  const refresh = () => {
    void refetch();
  };

  const connect = async (ssid: string, psk: string, hidden: boolean) => {
    setPending(null);
    setAskName(false);
    setState({ kind: 'connecting', ssid });
    try {
      await device.connectWifi(ssid, psk, hidden);
      setState({ kind: 'connected', ssid });
    } catch (error) {
      setState({ kind: 'error', ssid, message: wifiErrorMessage(error) });
    }
    refresh();
  };

  const stateEntry = (): MenuEntry | undefined => {
    const s = state();
    if (!s) return undefined;
    switch (s.kind) {
      case 'connecting':
        return info('wifi-state', `Connecting to ${s.ssid}…`);
      case 'connected':
        return info('wifi-state', `Connected to ${s.ssid}.`);
      case 'error':
        return info('wifi-state', s.message);
    }
  };

  const entry = (): MenuEntry | undefined => {
    const s = status();
    if (!s?.available) return undefined;

    const children: MenuEntry[] = [
      info(
        'wifi-current',
        s.current
          ? `Connected to ${s.current.ssid} (${s.current.signal}%)`
          : 'Not connected to Wi-Fi'
      ),
    ];
    const connecting = state()?.kind === 'connecting';
    const result = stateEntry();
    if (result) children.push(result);

    if (s.online) {
      children.push(
        info(
          'wifi-online',
          'The device is online: its Wi-Fi can only be changed here while it is offline.'
        )
      );
    } else if (!connecting) {
      s.networks.forEach((n) => {
        children.push({
          id: networkId(n.ssid),
          type: 'action',
          name: networkLabel(n),
          action: () => {
            if (n.secure) setPending({ ssid: n.ssid, hidden: false });
            else void connect(n.ssid, '', false);
          },
        });
        const p = pending();
        if (p && !p.hidden && p.ssid === n.ssid) {
          children.push({
            id: passwordId(n.ssid, false),
            type: 'input',
            inputType: 'password',
            name: `Password for ${n.ssid}`,
            placeholder: 'Type it and press Enter',
            action: (psk) => void connect(n.ssid, psk, false),
          });
        }
      });
      if (s.networks.length === 0) {
        children.push(info('wifi-none', s.error || 'No networks in range.'));
      }

      children.push({
        id: 'wifi-other',
        type: 'action',
        name: 'Other network…',
        action: () => {
          setPending(null);
          setAskName(true);
        },
      });
      if (askName()) {
        children.push({
          id: 'wifi-other-name',
          type: 'input',
          name: 'Network name',
          placeholder: 'Type it and press Enter',
          action: (ssid) => {
            const name = ssid.trim();
            if (!name) return;
            setAskName(false);
            setPending({ ssid: name, hidden: true });
          },
        });
      }
      const p = pending();
      if (p?.hidden) {
        children.push({
          id: passwordId(p.ssid, true),
          type: 'input',
          inputType: 'password',
          name: `Password for ${p.ssid} (empty if open)`,
          placeholder: 'Type it and press Enter',
          action: (psk) => void connect(p.ssid, psk, true),
        });
      }
      children.push({
        id: 'wifi-scan',
        type: 'action',
        name: 'Scan again',
        action: refresh,
      });
    }

    return {
      id: 'wifi',
      type: 'submenu',
      name: 'Wi-Fi',
      badge: s.online ? '#4caf50' : '#ff9900',
      children,
      action: (expanded) => {
        if (expanded) refresh();
      },
    };
  };

  return { entry, refresh };
}
