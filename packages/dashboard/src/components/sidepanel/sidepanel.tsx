import {
  Component,
  For,
  Show,
  Suspense,
  createEffect,
  lazy,
  on,
  onCleanup,
  onMount,
} from 'solid-js';
import './sidepanel.scss';
import PanelItem from '../panel-item/panel-item';
import { Dropdown, useMediaQuery } from '@castmill/ui-common';
import {
  NAV_COLLAPSED_QUERY,
  NAV_DRAWER_ID,
  NAV_OFFCANVAS_QUERY,
  navDrawer,
  navModeFor,
} from './nav-drawer';

import {
  IoCloseOutline,
  IoSettingsOutline,
  IoPersonOutline,
} from 'solid-icons/io';
import { AddOnTree } from '../../classes/addon-tree';
import { AddOnNode } from '../../interfaces/addon-node.interface';
import { store, setStore } from '../../store/store';
import { baseUrl } from '../../env';
import { TbChartHistogram, TbRobot, TbRss, TbBolt } from 'solid-icons/tb';
import { AiOutlineTeam, AiOutlineTags } from 'solid-icons/ai';
import { RiEditorOrganizationChart } from 'solid-icons/ri';
import { BsCalendarWeek, BsBuilding } from 'solid-icons/bs';
import { FiGrid } from 'solid-icons/fi';
import { useI18n } from '../../i18n';
import { useNavigate, useLocation } from '@solidjs/router';
import { canPerformAction } from '../../services/permissions.service';

const addOnBasePath = `${baseUrl}/assets/addons`;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SidePanelTree: Component<{
  node: AddOnNode;
  level: number;
  skipKeys?: string[];
  basePath?: string;
}> = (props) => {
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

  // Get the link path without wildcard suffixes (used for routes, not links)
  const getLinkPath = () => {
    if (!addon?.mount_path) return '';
    // Remove wildcard suffixes like /* or /*rest from the path
    return addon.mount_path.replace(/\/\*.*$/, '');
  };

  // Resolve base path: use provided basePath or default to org-scoped path
  const getBasePath = () =>
    props.basePath ?? `/org/${store.organizations.selectedId}`;

  return (
    <>
      <Show when={addon}>
        <Suspense fallback={<div style="height: 2.5em;"></div>}>
          <PanelItem
            to={`${getBasePath()}${getLinkPath()}`}
            text={getAddonName()}
            level={props.level}
            icon={lazy(
              () => import(/* @vite-ignore */ `${addOnBasePath}${addon?.icon}`)
            )}
          />
        </Suspense>
      </Show>
      <For each={children}>
        {([name, node]) => (
          <Show
            when={
              (node.children || node.addon) &&
              !(props.skipKeys && props.skipKeys.includes(name))
            }
          >
            <SidePanelTree
              node={node}
              level={props.level + 1}
              skipKeys={props.skipKeys}
              basePath={props.basePath}
            />
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
  const addonsBottomTree = props.addons.getSubTree('sidepanel.bottom');
  const addonsNetworkTree = props.addons.getSubTree('network');

  // Phones and portrait tablets get an off-canvas drawer, landscape tablets an
  // icon rail that expands into the drawer, desktops the static panel.
  const offCanvas = useMediaQuery(NAV_OFFCANVAS_QUERY, false);
  const collapsed = useMediaQuery(NAV_COLLAPSED_QUERY, false);
  const mode = () => navModeFor(offCanvas(), collapsed());
  const isOpen = () => mode() !== 'static' && navDrawer.isOpen();

  let panelRef: HTMLElement | undefined;
  let previousFocus: HTMLElement | null = null;
  let drawerWasOpen = false;

  onMount(() => onCleanup(navDrawer.register()));

  // Close on navigation and when the viewport grows into the static layout.
  createEffect(
    on(
      () => location.pathname,
      () => navDrawer.close(),
      { defer: true }
    )
  );
  createEffect(() => {
    if (mode() === 'static' && navDrawer.isOpen()) navDrawer.close();
  });

  const focusables = () =>
    Array.from(
      panelRef?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
    );

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      navDrawer.close();
      return;
    }
    if (event.key !== 'Tab') return;
    if (document.querySelector('[data-modal-overlay]')) return;

    // Keep focus inside the open drawer.
    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = !!active && !!panelRef?.contains(active);
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  };

  createEffect(
    on(isOpen, (open) => {
      if (open) {
        const opening = !drawerWasOpen;
        if (opening) {
          previousFocus = document.activeElement as HTMLElement | null;
        }
        drawerWasOpen = true;
        document.addEventListener('keydown', handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (opening) focusables()[0]?.focus();
        onCleanup(() => {
          document.removeEventListener('keydown', handleKeyDown);
          document.body.style.overflow = previousOverflow;
        });
      } else if (drawerWasOpen) {
        drawerWasOpen = false;
        const target = previousFocus;
        previousFocus = null;
        if (target?.isConnected) target.focus();
      }
    })
  );

  return (
    <div class="castmill-sidepanel-slot" data-mode={mode()}>
      <Show when={isOpen()}>
        <div
          class="castmill-sidepanel-backdrop"
          data-testid="sidepanel-backdrop"
          aria-hidden="true"
          onClick={() => navDrawer.close()}
        />
      </Show>
      <aside
        ref={panelRef}
        id={NAV_DRAWER_ID}
        class="castmill-sidepanel"
        classList={{ 'is-open': isOpen() }}
        data-mode={mode()}
        aria-label={t('sidebar.navigation')}
        role={isOpen() ? 'dialog' : undefined}
        aria-modal={isOpen() ? 'true' : undefined}
      >
        <Show when={isOpen()}>
          <div class="drawer-header">
            <button
              type="button"
              class="drawer-close"
              onClick={() => navDrawer.close()}
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <IoCloseOutline />
            </button>
          </div>
        </Show>
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

              // Update store
              setStore('organizations', {
                selectedId: value,
                selectedName: name,
              });

              if (location.pathname.startsWith('/org/')) {
                // Preserve current sub-path within the new organization
                const currentPath =
                  location.pathname.replace(/^\/org\/[^/]+/, '') || '/';
                navigate(`/org/${value}${currentPath}`);
              } else if (location.pathname === '/settings') {
                // Settings is a global route and should not be org-prefixed
                return;
              } else {
                // On non-org routes (e.g., network admin), navigate to the new org's home
                navigate(`/org/${value}`);
              }
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
            <SidePanelTree
              node={addonsPanelTree!}
              level={-1}
              skipKeys={['bottom']}
            />
          </Show>
          <PanelItem
            to={`/org/${store.organizations.selectedId}/channels`}
            text={t('sidebar.channels')}
            level={0}
            icon={BsCalendarWeek}
          />
          <Show
            when={canPerformAction(
              store.permissions?.matrix,
              'automations',
              'list'
            )}
          >
            <PanelItem
              to={`/org/${store.organizations.selectedId}/automations`}
              text={t('sidebar.automations')}
              level={0}
              icon={TbBolt}
            />
          </Show>

          <PanelItem
            to={`/org/${store.organizations.selectedId}/teams`}
            text={t('sidebar.teams')}
            level={0}
            icon={AiOutlineTeam}
          />
          <PanelItem
            to={`/org/${store.organizations.selectedId}/tags`}
            text={t('sidebar.tags')}
            level={0}
            icon={AiOutlineTags}
          />
          <PanelItem
            to={`/org/${store.organizations.selectedId}/feeds`}
            text={t('sidebar.feeds')}
            level={0}
            icon={TbRss}
          />
          <Show
            when={
              store.permissions?.role === 'admin' ||
              store.permissions?.role === 'manager'
            }
          >
            <PanelItem
              to={`/org/${store.organizations.selectedId}/agents`}
              text={t('sidebar.agents')}
              level={0}
              icon={TbRobot}
            />
          </Show>
          <PanelItem
            to={`/org/${store.organizations.selectedId}/usage`}
            text={t('sidebar.usage')}
            level={0}
            icon={TbChartHistogram}
          />
          <PanelItem
            to="/settings"
            text={t('common.settings')}
            level={0}
            icon={IoSettingsOutline}
          />

          <Show when={addonsBottomTree}>
            <SidePanelTree node={addonsBottomTree!} level={-1} />
          </Show>

          {/* Network Admin Section - only visible to network admins */}
          <Show when={store.network.isAdmin}>
            <div class="network-admin-section">
              <div class="section-divider"></div>
              <PanelItem
                to="/network"
                text={t('sidebar.network')}
                level={0}
                icon={BsBuilding}
              />
              <PanelItem
                to="/network/settings"
                text={t('sidebar.networkSettings')}
                level={1}
                icon={IoSettingsOutline}
              />
              <PanelItem
                to="/network/organizations"
                text={t('sidebar.networkOrganizations')}
                level={1}
                icon={RiEditorOrganizationChart}
              />
              <PanelItem
                to="/network/users"
                text={t('sidebar.networkUsers')}
                level={1}
                icon={IoPersonOutline}
              />
              <PanelItem
                to="/network/widgets"
                text={t('sidebar.networkWidgets')}
                level={1}
                icon={FiGrid}
              />
              <Show when={addonsNetworkTree}>
                <SidePanelTree
                  node={addonsNetworkTree!}
                  level={0}
                  basePath="/network"
                />
              </Show>
            </div>
          </Show>
        </div>
      </aside>
    </div>
  );
};

export default SidePanel;
