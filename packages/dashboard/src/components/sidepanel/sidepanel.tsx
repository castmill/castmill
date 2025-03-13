import { Component, For, Show, Suspense, lazy } from 'solid-js';
import './sidepanel.scss';
import PanelItem from '../panel-item/panel-item';
import { Dropdown } from '@castmill/ui-common';

import { IoSettingsOutline } from 'solid-icons/io';
import { AddOnTree } from '../../classes/addon-tree';
import { AddOnNode } from '../../interfaces/addon-node.interface';
import { store, setStore } from '../../store/store';
import { baseUrl } from '../../env';
import { TbChartHistogram } from 'solid-icons/tb';
import { AiOutlineTeam } from 'solid-icons/ai';
import { RiEditorOrganizationChart } from 'solid-icons/ri';
import { BsCalendarWeek } from 'solid-icons/bs';

const addOnBasePath = `${baseUrl}/assets/addons`;

const SidePanelTree: Component<{ node: AddOnNode; level: number }> = (
  props
) => {
  const addon = props.node.addon;
  const children = Array.from(props.node.children || []);

  return (
    <>
      <Show when={addon}>
        <Suspense fallback={<div>Loading...</div>}>
          <PanelItem
            to={addon!.mount_path || ''}
            text={addon!.name}
            level={props.level}
            icon={lazy(() => import(`${addOnBasePath}${addon?.icon}`))}
          />
        </Suspense>
      </Show>
      <For each={children}>
        {([name, node]) => (
          <Show when={node.children || node.addon}>
            <SidePanelTree node={node} level={props.level + 1} />
          </Show>
        )}
      </For>
    </>
  );
};

const SidePanel: Component<{ addons: AddOnTree }> = (props) => {
  /*
  Addons include a "mount_point" property that is a period separated string that 
  represents where in the application the addon should be mounted. For example, if
  the mount_point is "admin.settings", the AddOn will be mounted at /admin/settings.

  Since we are in the SidePanel component, we need to filter the addons that have a
  mount_point that starts with "sidepanel". Note that the addons can be nested, so
  we need to check if the mount_point starts with "sidepanel" and if it is nested like for
  example: "sidepanel.content.medias" create the proper entry in the panel.
  */
  const addonsPanelTree = props.addons.getSubTree('sidepanel');

  return (
    <div class="castmill-sidepanel">
      <div class="top">
        <Dropdown
          label="Organization"
          items={store.organizations.data.map((org) => ({
            name: org.name,
            value: org.id,
          }))}
          onSelectChange={(value, name) => {
            setStore('organizations', {
              selectedId: value,
              selectedName: name,
            });
          }}
        />
      </div>
      <div class="links">
        <PanelItem
          to="/organization"
          text="Organization"
          level={0}
          icon={RiEditorOrganizationChart}
        />

        <Show when={addonsPanelTree}>
          <SidePanelTree node={addonsPanelTree!} level={-1} />
        </Show>
        <PanelItem
          to="/channels"
          text="Channels"
          level={0}
          icon={BsCalendarWeek}
        />

        <PanelItem to="/teams" text="Teams" level={0} icon={AiOutlineTeam} />
        <PanelItem to="/usage" text="Usage" level={0} icon={TbChartHistogram} />
        <PanelItem
          to="/settings"
          text="Settings"
          level={0}
          icon={IoSettingsOutline}
        />
      </div>
    </div>
  );
};

export default SidePanel;
