import { RouteSectionProps } from "@solidjs/router";
import { Component } from "solid-js";

import SidePanel from "../sidepanel/sidepanel";

import "./dashboard.scss";

const Dashboard: Component<RouteSectionProps<unknown>> = (props) => {
  return (
    <div class="castmill-dashboard">
      <SidePanel />
      <div class="content">
        <h1>Dashboard</h1>
        {props.children}
      </div>
    </div>
  );
};

export default Dashboard;
