/** @jsxImportSource solid-js */

import {
  Accessor,
  Component,
  JSX,
  ParentComponent,
  Show,
  children,
  createContext,
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { VsClose } from 'solid-icons/vs';
import { IconButton } from '../icon-button/icon-button';
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox';

import styles from './drawer.module.scss';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DrawerPlacement = 'left' | 'right';

export interface DrawerProps {
  onClose: () => void;
  children: JSX.Element;
  title: string;
  closeButtonTitle?: string;
  description?: string;
  size?: DrawerSize;
  placement?: DrawerPlacement;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  showBackdrop?: boolean | 'auto';
  autoBackdropBreakpoint?: number;
  closeOnOutsideClick?: boolean;
  outsideClickIgnoreSelector?: string;
  headerActions?: JSX.Element;
  footer?: JSX.Element;
  contentClass?: string;
}

interface DrawerFooterSlot {
  mount: Accessor<HTMLElement | undefined>;
  register: () => () => void;
}

const DrawerFooterContext = createContext<DrawerFooterSlot>();

/**
 * Renders its children in the sticky footer of the enclosing Drawer, so a
 * details view can own its Save/Reset actions while they stay pinned to the
 * drawer edge. Outside a Drawer the children render in place.
 */
export const DrawerFooter: ParentComponent = (props) => {
  const slot = useContext(DrawerFooterContext);
  if (!slot) {
    return <>{props.children}</>;
  }
  onCleanup(slot.register());
  return (
    <Show when={slot.mount()}>
      {(mount) => <Portal mount={mount()}>{props.children}</Portal>}
    </Show>
  );
};

const animationDuration = 300;
let drawerStack: string[] = [];
let drawerIdCounter = 0;

function isTopDrawer(drawerId: string) {
  return drawerStack[drawerStack.length - 1] === drawerId;
}

function removeDrawer(drawerId: string) {
  drawerStack = drawerStack.filter((id) => id !== drawerId);
}

export const Drawer: Component<DrawerProps> = (_props) => {
  const viewportBox = useVisualViewportBox();
  const props = mergeProps(
    {
      size: 'xl' as DrawerSize,
      placement: 'right' as DrawerPlacement,
      closeButtonTitle: 'Close',
      closeOnEscape: true,
      closeOnOverlayClick: true,
      showBackdrop: false,
      autoBackdropBreakpoint: 1280,
      closeOnOutsideClick: false,
      outsideClickIgnoreSelector: '',
      contentClass: '',
    },
    _props
  );

  const drawerId = `drawer-${++drawerIdCounter}`;
  const footer = children(() => props.footer);
  const [footerSlots, setFooterSlots] = createSignal(0);
  const [footerEl, setFooterEl] = createSignal<HTMLElement>();
  const footerSlot: DrawerFooterSlot = {
    mount: footerEl,
    register: () => {
      setFooterSlots((n) => n + 1);
      return () => setFooterSlots((n) => n - 1);
    },
  };
  const [isVisible, setIsVisible] = createSignal(false);
  const [isActive, setIsActive] = createSignal(false);
  const [hasBackdrop, setHasBackdrop] = createSignal(
    props.showBackdrop === 'auto'
      ? typeof window !== 'undefined' &&
          window.innerWidth < props.autoBackdropBreakpoint
      : !!props.showBackdrop
  );

  let panelRef: HTMLDivElement | undefined;
  let previousFocusedElement: HTMLElement | null = null;
  let activateTimeout: ReturnType<typeof setTimeout> | undefined;
  let closeTimeout: ReturnType<typeof setTimeout> | undefined;
  let isClosing = false;
  let hasDetachedGlobalListeners = false;
  let hasRestoredFocus = false;

  const updateBackdropMode = () => {
    if (props.showBackdrop === 'auto') {
      setHasBackdrop(window.innerWidth < props.autoBackdropBreakpoint);
      return;
    }

    setHasBackdrop(!!props.showBackdrop);
  };

  const detachGlobalListeners = () => {
    if (hasDetachedGlobalListeners) {
      return;
    }

    hasDetachedGlobalListeners = true;
    window.removeEventListener('resize', updateBackdropMode);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', closeOnOutsideClick, true);
    removeDrawer(drawerId);
  };

  const restorePreviousFocus = () => {
    if (hasRestoredFocus) {
      return;
    }

    hasRestoredFocus = true;
    if (previousFocusedElement) {
      previousFocusedElement.focus();
    }
  };

  const closeDrawer = () => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    setIsActive(false);

    closeTimeout = setTimeout(() => {
      setIsVisible(false);
      detachGlobalListeners();
      restorePreviousFocus();
      props.onClose();
      closeTimeout = undefined;
    }, animationDuration);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!props.closeOnEscape) {
      return;
    }

    if (
      event.key === 'Escape' &&
      !event.defaultPrevented &&
      isTopDrawer(drawerId)
    ) {
      closeDrawer();
    }
  };

  const closeOnOverlayClick = (event: MouseEvent) => {
    if (!props.closeOnOverlayClick || !hasBackdrop()) {
      return;
    }

    if (event.target === event.currentTarget) {
      closeDrawer();
    }
  };

  const closeOnOutsideClick = (event: MouseEvent) => {
    if (!props.closeOnOutsideClick || hasBackdrop() || !isTopDrawer(drawerId)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (panelRef?.contains(target)) {
      return;
    }

    // Layered overlays can come from a separately bundled UI context and may
    // not share this module's drawer stack.
    if (
      target.closest(
        '[data-modal-overlay], [data-drawer-panel], [data-combobox-sheet]'
      )
    ) {
      return;
    }

    if (
      props.outsideClickIgnoreSelector &&
      (target.closest(props.outsideClickIgnoreSelector) ||
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof Element &&
              node.matches(props.outsideClickIgnoreSelector)
          ))
    ) {
      return;
    }

    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (link && navigatesAway(link, event)) {
      dismissForNavigation();
      return;
    }

    closeDrawer();
  };

  // Plain clicks on links that leave the current URL (e.g. menu items).
  const navigatesAway = (link: HTMLAnchorElement, event: MouseEvent) =>
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !link.hasAttribute('download') &&
    (!link.target || link.target === '_self') &&
    link.href.split('#')[0] !== window.location.href.split('#')[0];

  // Hide without onClose: the owner's close handler usually restores the list
  // URL (history.back()), which would race with and undo the link's
  // navigation. The navigation itself updates the owner's URL-driven state.
  // Addon pages are not disposed on route changes, so the portaled drawer
  // must still disappear here.
  const dismissForNavigation = () => {
    if (isClosing) {
      return;
    }
    isClosing = true;
    setIsActive(false);
    setIsVisible(false);
    detachGlobalListeners();
  };

  onMount(() => {
    previousFocusedElement = document.activeElement as HTMLElement;

    setIsVisible(true);
    activateTimeout = setTimeout(() => {
      // Commit the off-screen start position so the slide-in transition runs.
      void panelRef?.offsetWidth;
      setIsActive(true);
      // Focusing the still off-screen panel would scroll it into view, which
      // skips the slide-in and makes it overshoot as the scroll is undone.
      panelRef?.focus({ preventScroll: true });
    }, 0);

    updateBackdropMode();

    window.addEventListener('resize', updateBackdropMode);
    document.addEventListener('keydown', handleKeyDown);
    drawerStack.push(drawerId);
  });

  createEffect(() => {
    if (!isVisible()) {
      return;
    }

    if (!props.closeOnOutsideClick || hasBackdrop()) {
      return;
    }

    document.addEventListener('click', closeOnOutsideClick, true);

    onCleanup(() => {
      document.removeEventListener('click', closeOnOutsideClick, true);
    });
  });

  createEffect(() => {
    if (!isVisible()) {
      return;
    }

    if (!hasBackdrop()) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    onCleanup(() => {
      document.body.style.overflow = originalOverflow;
    });
  });

  onCleanup(() => {
    if (activateTimeout) {
      clearTimeout(activateTimeout);
      activateTimeout = undefined;
    }

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    detachGlobalListeners();
    restorePreviousFocus();
  });

  const panelClass = () => {
    const classes = [
      styles.drawerPanel,
      styles[`size${props.size.charAt(0).toUpperCase()}${props.size.slice(1)}`],
      props.placement === 'left' ? styles.left : styles.right,
      isActive() ? styles.active : '',
    ];

    if (props.contentClass) {
      classes.push(props.contentClass);
    }

    return classes.join(' ').trim();
  };

  return (
    <Portal mount={document.body}>
      <Show when={isVisible()}>
        <div
          data-testid="drawer-root"
          data-has-backdrop={hasBackdrop() ? 'true' : 'false'}
          class={`${styles.drawerRoot} ${hasBackdrop() ? styles.withBackdrop : styles.withoutBackdrop}`}
          style={viewportBox()}
          onClick={closeOnOverlayClick}
        >
          <div
            role="dialog"
            aria-modal={hasBackdrop()}
            aria-label={props.title}
            data-drawer-panel
            class={panelClass()}
            style={(() => {
              // When pinned to the visual viewport the root already has the
              // visible height; dvh would refer to the enlarged layout one.
              const h = viewportBox() ? '100%' : '100dvh';
              return { height: h, 'min-height': h, 'max-height': h };
            })()}
            ref={panelRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div class={styles.header}>
              <div class={styles.titleWrapper}>
                <h2>{props.title}</h2>
                {props.description && <p>{props.description}</p>}
              </div>
              <div class={styles.headerActions}>
                {props.headerActions}
                <IconButton
                  icon={VsClose}
                  onClick={closeDrawer}
                  color="ghost"
                  title={props.closeButtonTitle}
                />
              </div>
            </div>
            <div class={styles.body}>
              <DrawerFooterContext.Provider value={footerSlot}>
                {props.children}
              </DrawerFooterContext.Provider>
            </div>
            <Show when={footer() || footerSlots() > 0}>
              <div
                class={styles.footer}
                ref={(el) => {
                  setFooterEl(el);
                  onCleanup(() => setFooterEl(undefined));
                }}
              >
                {footer()}
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </Portal>
  );
};
