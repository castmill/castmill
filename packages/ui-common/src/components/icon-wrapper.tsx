import { Component } from 'solid-js';
import { IconTypes } from 'solid-icons';

const IconWrapper: Component<{ icon: IconTypes }> = (props) => {
  return (
    <div class="icon-wrapper">
      <props.icon />
    </div>
  );
};

export default IconWrapper;
