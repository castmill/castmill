import { Component } from "solid-js";
import "./sidepanel.scss";
import PanelItem from "../panel-item/panel-item";
import Dropdown from "../dropdown/dropdown";

import { IoSettingsOutline } from "solid-icons/io";

const organizations = [
  {
    name: "Castmill",
    value: "castmill",
  },
  {
    name: "Tylöprint",
    value: "tyloprint",
  },
  {
    name: "AdCode",
    value: "adcode",
  },
];

const SidePanel: Component = () => {
  return (
    <div class="castmill-sidepanel">
      <div class="top">
        <Dropdown label="Organization" items={organizations} />
      </div>
      <div class="links">
        <PanelItem to="/settings" text="Settings" icon={IoSettingsOutline} />
      </div>
    </div>
  );
};

export default SidePanel;
