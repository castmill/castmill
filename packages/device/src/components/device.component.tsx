import {
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { Device, Status } from '../classes/device';
import { RegisterComponent } from './register.component';
import { PlayerComponent } from './player.component';
import { ProgressBarComponent } from './progress-bar.component';

export function DeviceComponent(props: { device: Device }) {
  const [loginOrRegister] = createResource(() =>
    props.device.loginOrRegister()
  );
  const [ready, setReady] = createSignal(false);

  // Listen for 'ready' event to hide progress bar (fired by start() or timer-off standby)
  onMount(() => {
    const onReady = () => setReady(true);
    props.device.on('ready', onReady);
    onCleanup(() => props.device.off('ready', onReady));
  });

  // Show progress bar while loading or while login's start() is still running
  const showProgress = () => {
    if (loginOrRegister.loading) return true;
    if (loginOrRegister()?.status === Status.Ready && !ready()) return true;
    return false;
  };

  return (
    <>
      {/* Progress bar overlay — shown during login/register flow and start() */}
      <Show when={showProgress()}>
        <ProgressBarComponent device={props.device} />
      </Show>

      {/* Main content — rendered after loginOrRegister resolves */}
      <Show when={!loginOrRegister.loading}>
        <Switch>
          <Match when={loginOrRegister.error}>
            <span>{String(loginOrRegister.error)}</span>
          </Match>
          <Match when={loginOrRegister()?.status === Status.Ready}>
            <PlayerComponent device={props.device} />
          </Match>
          <Match when={loginOrRegister()?.status === Status.Registering}>
            <RegisterComponent
              device={props.device}
              pincode={loginOrRegister()!.pincode!}
            />
          </Match>
        </Switch>
      </Show>
    </>
  );
}
