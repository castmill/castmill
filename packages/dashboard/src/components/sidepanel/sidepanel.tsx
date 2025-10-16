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
import { useI18n } from '../../i18n';
import { useNavigate, useLocation } from '@solidjs/router';

const addOnBasePath = `${baseUrl}/assets/addons`;

const SidePanelTree: Component<{ node: AddOnNode; level: number }> = (
  props
) => {
  const { t } = useI18n();
  const addon = props.node.addon;
  const children = Array.from(props.node.children || []);

  // Get the translated name for the addon
  const getAddonName = () => {
    if (!addon) return '';
    // If the addon provides a name_key, use it for translation
    // Otherwise, fall back to the addon's name
    return addon.name_key ? t(addon.name_key) : addon.name;
  };

  return (
    <>
      <Show when={addon}>
        <Suspense fallback={<div style="height: 2.5em;"></div>}>
          <PanelItem
            to={`/org/${store.organizations.selectedId}${addon!.mount_path || ''}`}
            text={getAddonName()}
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

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
          id="organization-selector"
          name="organization"
          label={t('sidebar.organization')}
          items={store.organizations.data.map((org) => ({
            name: org.name,
            value: org.id,
          }))}
          defaultValue={store.organizations.selectedId ?? undefined}
          onSelectChange={(value, name) => {
            if (!value) {
              return;
            }
            // Extract current path without /org/:orgId prefix
            const currentPath =
              location.pathname.replace(/^\/org\/[^\/]+/, '') || '/';

            // Navigate to new organization with same path
            navigate(`/org/${value}${currentPath}`);

            // Update store (will be synced from URL by protected route)
            setStore('organizations', {
              selectedId: value,
              selectedName: name,
            });
          }}
        />
      </div>
      <div class="links">
        <PanelItem
          to={`/org/${store.organizations.selectedId}/organization`}
          text={t('sidebar.organization')}
          level={0}
          icon={RiEditorOrganizationChart}
        />

        <Show when={addonsPanelTree}>
          <SidePanelTree node={addonsPanelTree!} level={-1} />
        </Show>
        <PanelItem
          to={`/org/${store.organizations.selectedId}/channels`}
          text={t('sidebar.channels')}
          level={0}
          icon={BsCalendarWeek}
        />

        <PanelItem
          to={`/org/${store.organizations.selectedId}/teams`}
          text={t('sidebar.teams')}
          level={0}
          icon={AiOutlineTeam}
        />
        <PanelItem
          to={`/org/${store.organizations.selectedId}/usage`}
          text={t('sidebar.usage')}
          level={0}
          icon={TbChartHistogram}
        />
        <PanelItem
          to={`/org/${store.organizations.selectedId}/settings`}
          text={t('common.settings')}
          level={0}
          icon={IoSettingsOutline}
        />
      </div>
    </div>
  );
};

export default SidePanel;
