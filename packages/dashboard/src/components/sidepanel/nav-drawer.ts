/**
 * Shared state for the responsive navigation drawer.
 *
 * The top bar owns the menu button and the side panel owns the drawer, but
 * they live in different parts of the route tree, so the open state is kept
 * in a module-level root.
 */
import { createRoot, createSignal } from 'solid-js';
import { BREAKPOINTS_EM, TABLET_LAYOUT_QUERY } from '@castmill/ui-common';

/**
 * Up to this width the side panel is an off-canvas drawer and the top bar is
 * compact (phones, portrait tablets).
 */
export const NAV_OFFCANVAS_QUERY = TABLET_LAYOUT_QUERY;
/** Up to this width the side panel collapses (icon rail on landscape tablets). */
export const NAV_COLLAPSED_QUERY = `(max-width: ${BREAKPOINTS_EM.wide}em)`;
/** Devices without a hover-capable fine pointer (no keyboard shortcuts UI). */
export const TOUCH_QUERY = '(hover: none), (pointer: coarse)';

/** DOM id of the side panel, referenced by the menu button's aria-controls. */
export const NAV_DRAWER_ID = 'castmill-sidepanel';

export type NavMode = 'static' | 'rail' | 'drawer';

export const navModeFor = (offCanvas: boolean, collapsed: boolean): NavMode =>
  offCanvas ? 'drawer' : collapsed ? 'rail' : 'static';

const state = createRoot(() => {
  const [isOpen, setOpen] = createSignal(false);
  const [panels, setPanels] = createSignal(0);
  return { isOpen, setOpen, panels, setPanels };
});

export const navDrawer = {
  isOpen: state.isOpen,
  open: () => state.setOpen(true),
  close: () => state.setOpen(false),
  toggle: () => state.setOpen(!state.isOpen()),
  /** True while a side panel is mounted (so the menu button has a target). */
  isAvailable: () => state.panels() > 0,
  /** Registers a mounted side panel; returns the unregister function. */
  register: () => {
    state.setPanels((count) => count + 1);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      state.setPanels((count) => count - 1);
      if (state.panels() === 0) state.setOpen(false);
    };
  },
};
