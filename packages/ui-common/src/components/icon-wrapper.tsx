import { Component, For } from 'solid-js';
import { IconTypes } from 'solid-icons';

// This strange wrapper is necessary to render the icons correctly or they wont be rendered at all
// in the Addons. Wrapping in a dummy For loop is a workaround for the issue.
export const IconWrapper: Component<{ icon: IconTypes; props?: any }> = (
  props
) => {
  return (
    <For each={[0]}>
      {() => <props.icon {...(props.props ? props.props : {})} />}
    </For>
  );
};
