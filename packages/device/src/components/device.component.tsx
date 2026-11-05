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
import { RecoveryBlockedComponent } from './recovery-blocked.component';

export function DeviceComponent(props: { device: Device }) {
  const [loginOrRegister] = createResource<{
    value?: Awaited<ReturnType<Device['loginOrRegister']>>;
    error?: Error;
  }>(() =>
    props.device.loginOrRegister().then(
      (value) => ({ value }),
      (error: unknown) => {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        props.device.reportStartupError(failure);
        return { error: failure };
      }
    )
  );
  const [ready, setReady] = createSignal(false);
  const [startupError, setStartupError] = createSignal<Error>();

  // Listen for 'ready' event to hide progress bar (fired by start() or timer-off standby)
  onMount(() => {
    const onReady = () => setReady(true);
    const onStartupError = (error: Error) => setStartupError(error);
    props.device.on('ready', onReady);
    props.device.on('startup-error', onStartupError);
    onCleanup(() => {
      props.device.off('ready', onReady);
      props.device.off('startup-error', onStartupError);
    });
  });

  // Show progress bar while loading or while login's start() is still running
  const showProgress = () => {
    if (loginOrRegister.loading) return true;
    if (startupError()) return false;
    if (loginOrRegister()?.value?.status === Status.Ready && !ready())
      return true;
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
          <Match when={startupError() || loginOrRegister()?.error}>
            <div
              role="alert"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'box-sizing': 'border-box',
                padding: '2em',
                background: 'black',
                color: 'white',
                'z-index': 9999,
              }}
            >
              {startupError()?.message ?? String(loginOrRegister()?.error)}
            </div>
          </Match>
          <Match when={loginOrRegister()?.value?.status === Status.Ready}>
            <PlayerComponent device={props.device} />
          </Match>
          <Match when={loginOrRegister()?.value?.status === Status.Registering}>
            <RegisterComponent
              device={props.device}
              pincode={loginOrRegister()!.value!.pincode!}
            />
          </Match>
          <Match
            when={loginOrRegister()?.value?.status === Status.RecoveryBlocked}
          >
            <RecoveryBlockedComponent />
          </Match>
        </Switch>
      </Show>
    </>
  );
}
