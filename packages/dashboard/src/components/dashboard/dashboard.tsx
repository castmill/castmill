import { RouteSectionProps } from '@solidjs/router';
import { Component } from 'solid-js';

import SidePanel from '../sidepanel/sidepanel';

import './dashboard.scss';
import { AddOnTree } from '../../classes/addon-tree';

// Define a type that includes RouteSectionProps and your addons
interface DashboardProps extends RouteSectionProps<unknown> {
  addons: AddOnTree; // Use a more specific type for your addons if possible
}

const Dashboard: Component<DashboardProps> = (props) => {
  return (
    <div class="castmill-dashboard">
      <SidePanel addons={props.addons} />
      <div class="content">
        {props.children}
      </div>
    </div>
  );
};

export default Dashboard;
