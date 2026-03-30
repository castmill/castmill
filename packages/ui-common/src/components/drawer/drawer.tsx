/** @jsxImportSource solid-js */

import {
  Component,
  JSX,
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { VsClose } from 'solid-icons/vs';
import { IconButton } from '../icon-button/icon-button';

import styles from './drawer.module.scss';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DrawerPlacement = 'left' | 'right';

export interface DrawerProps {
  onClose: () => void;
  children: JSX.Element;
  title: string;
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
  const props = mergeProps(
    {
      size: 'xl' as DrawerSize,
      placement: 'right' as DrawerPlacement,
      closeOnEscape: true,
      closeOnOverlayClick: true,
      showBackdrop: 'auto' as const,
      autoBackdropBreakpoint: 1280,
      closeOnOutsideClick: false,
      outsideClickIgnoreSelector: '',
      contentClass: '',
    },
    _props
  );

  const drawerId = `drawer-${++drawerIdCounter}`;
  const [isVisible, setIsVisible] = createSignal(false);
  const [isActive, setIsActive] = createSignal(false);
  const [hasBackdrop, setHasBackdrop] = createSignal(true);

  let panelRef: HTMLDivElement | undefined;
  let previousFocusedElement: HTMLElement | null = null;
  let activateTimeout: ReturnType<typeof setTimeout> | undefined;
  let closeTimeout: ReturnType<typeof setTimeout> | undefined;
  let isClosing = false;

  const updateBackdropMode = () => {
    if (props.showBackdrop === 'auto') {
      setHasBackdrop(window.innerWidth < props.autoBackdropBreakpoint);
      return;
    }

    setHasBackdrop(!!props.showBackdrop);
  };

  const closeDrawer = () => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    setIsActive(false);

    closeTimeout = setTimeout(() => {
      setIsVisible(false);
      props.onClose();
      removeDrawer(drawerId);
      closeTimeout = undefined;
    }, animationDuration);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!props.closeOnEscape) {
      return;
    }

    if (event.key === 'Escape' && isTopDrawer(drawerId)) {
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

    // Don't close if clicking inside a modal/dialog that is layered on top
    if (target.closest('[data-modal-overlay]')) {
      return;
    }

    if (
      props.outsideClickIgnoreSelector &&
      target.closest(props.outsideClickIgnoreSelector)
    ) {
      return;
    }

    closeDrawer();
  };

  onMount(() => {
    previousFocusedElement = document.activeElement as HTMLElement;

    setIsVisible(true);
    activateTimeout = setTimeout(() => {
      setIsActive(true);
      panelRef?.focus();
    }, 0);

    updateBackdropMode();

    window.addEventListener('resize', updateBackdropMode);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', closeOnOutsideClick, true);
    drawerStack.push(drawerId);
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

    window.removeEventListener('resize', updateBackdropMode);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', closeOnOutsideClick, true);
    removeDrawer(drawerId);

    if (previousFocusedElement) {
      previousFocusedElement.focus();
    }
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
      <div
        data-testid="drawer-root"
        data-has-backdrop={hasBackdrop() ? 'true' : 'false'}
        class={`${styles.drawerRoot} ${hasBackdrop() ? styles.withBackdrop : styles.withoutBackdrop}`}
        onClick={closeOnOverlayClick}
      >
        <div
          role="dialog"
          aria-modal={hasBackdrop()}
          aria-label={props.title}
          class={panelClass()}
          style={{
            height: '100dvh',
            'min-height': '100dvh',
            'max-height': '100dvh',
          }}
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
                color="secondary"
                title="Close"
              />
            </div>
          </div>
          <div class={styles.body}>{props.children}</div>
          {props.footer && <div class={styles.footer}>{props.footer}</div>}
        </div>
      </div>
    </Portal>
  );
};
