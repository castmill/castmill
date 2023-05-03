import { Match, Show, Switch, createResource } from "solid-js";
import { Device, Status } from "../classes/device";
import { RegisterComponent } from "./register.component";
import { PlayerComponent } from "./player.component";

export function DeviceComponent(props: { device: Device }) {
  const [loginOrRegister, { mutate, refetch }] = createResource(() =>
    props.device.loginOrRegister()
  );

  return (
    <>
      <span>Device Component</span>
      <Show
        when="!loginOrRegister.loading && !loginOrRegister.error"
        fallback={<span>...loading...</span>}
      >
        <Switch>
          <Match when={loginOrRegister.error}>
            <span>{loginOrRegister.error}</span>
          </Match>
          <Match when={loginOrRegister()?.status == Status.Login}>
            <PlayerComponent device={props.device} />
          </Match>
          <Match when={loginOrRegister()?.status == Status.Registering}>
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
