/** @jsxImportSource solid-js */

import {
  Component,
  JSX,
  onMount,
  onCleanup,
  createSignal,
  createEffect,
  mergeProps,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { BsCheckLg, BsArrowRepeat } from 'solid-icons/bs';
import { VsClose } from 'solid-icons/vs';
import { IconButton } from '../icon-button/icon-button';
import { Button } from '../button/button';

import styles from './modal.module.scss';

export interface ModalRef {
  close: () => Promise<void>;
}
interface ModalProps {
  onClose: () => void;
  children: JSX.Element;
  title: string;
  description: string;
  successMessage?: string;
  errorMessage?: string;
  loading?: boolean;
  autoCloseDelay?: number;
  showRetryButton?: boolean;
  contentClass?: string;

  ref?: (ref: ModalRef) => void;
}

const animationDuration = 300;
let modalStack: string[] = [];

function isTopModal(modalId: string) {
  return modalStack[modalStack.length - 1] === modalId;
}

function removeModal(modalId: string) {
  modalStack = modalStack.filter((id) => id !== modalId);
}

interface AnimatedSizeWrapperProps {
  children: any;
}

export const AnimatedSizeWrapper: Component<AnimatedSizeWrapperProps> = (
  props
) => {
  // Store the “current displayed” width/height
  const [size, setSize] = createSignal({ width: 'auto', height: 'auto' });

  let contentRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    // Create the ResizeObserver
    let prevEventTimestamp = 0;
    resizeObserver = new ResizeObserver((entries) => {
      if (prevEventTimestamp + 250 > Date.now()) {
        return;
      }

      prevEventTimestamp = Date.now();
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Update the signal with the newly observed size
        setSize({ width: `${width}px`, height: `${height}px` });
        break;
      }
    });

    // Start observing the content div
    if (contentRef) {
      resizeObserver.observe(contentRef);
    }
  });

  // Clean up when component unmounts
  onCleanup(() => {
    if (contentRef && resizeObserver) {
      resizeObserver.unobserve(contentRef);
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  return (
    <div
      style={{
        /* Animate from old -> new dimensions */
        width: '100%',
        height: '100%',
        transition: 'width 0.3s ease, height 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* The actual content whose size is being observed */}
      <div
        style="display: inline-block; width: 100%; height: 100%;"
        ref={contentRef}
      >
        {props.children}
      </div>
    </div>
  );
};
export const Modal: Component<ModalProps> = (props) => {
  const modalId = Math.random().toString(36).substring(7);

  props = mergeProps(
    {
      showRetryButton: false,
    },
    props
  );

  const [isLoading, setIsLoading] = createSignal(props.loading || false);

  const [isVisible, setIsVisible] = createSignal(false);
  const [isActive, setIsActive] = createSignal(false);

  const closeModal = () => {
    // First, trigger the transition
    setIsActive(false);

    // Then, after the transition duration, hide the modal completely
    setTimeout(() => {
      setIsVisible(false);
      props.onClose();
      removeModal(modalId);
    }, animationDuration); // This should match the CSS transition duration
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isTopModal(modalId)) {
      closeModal();
    }
  };

  const closeModalOnOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  };

  onMount(() => {
    setIsVisible(true);
    setTimeout(() => {
      setIsActive(true); // Activates transitions after the portal content is in the DOM
    }, 0); // A minimal delay

    modalStack.push(modalId);
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    closeModal();
    document.removeEventListener('keydown', handleKeyDown);
    removeModal(modalId);
  });

  // Automatically close the modal after a success message, if specified
  createEffect(() => {
    if (props.successMessage && props.autoCloseDelay) {
      const timer = setTimeout(props.onClose, props.autoCloseDelay);
      return () => clearTimeout(timer);
    }
  });

  const contentClasses = () => {
    const classes = `${styles.modalContent} ${isActive() ? styles.active : ''}`;
    if (props.contentClass) {
      return `${classes} ${props.contentClass}`;
    }
    return classes;
  };

  const ref = {
    close: async () => {
      closeModal();
    },
  };

  if (props.ref) {
    props.ref(ref); // Assign the methods to the ref passed from the parent
  }

  return (
    <Portal mount={document.body}>
      <div
        data-testid="modal-overlay"
        class={`${styles.modalOverlay} ${isActive() ? styles.active : ''}`}
        onClick={closeModalOnOverlayClick}
      >
        <div class={contentClasses()} onClick={(e) => e.stopPropagation()}>
          <div class={styles.modalHeader}>
            <div class={styles.title}>
              <h2>{props.title}</h2>
              <h3>{props.description}</h3>
            </div>
            <IconButton icon={VsClose} onClick={closeModal} color="secondary" />
          </div>
          {props.successMessage && (
            <div class={styles.modalSuccess}>{props.successMessage}</div>
          )}
          {props.errorMessage && (
            <div class={styles.modalError}>{props.errorMessage}</div>
          )}
          <div class={styles.modalBody}>
            {/* Instead of showing children directly, wrap them: */}
            <AnimatedSizeWrapper>{props.children}</AnimatedSizeWrapper>
          </div>
          {isLoading() && <div class={styles.modalLoading}>Loading...</div>}
          <div class={styles.modalFooter}>
            {props.successMessage && (
              <Button icon={BsCheckLg} label="Close" onClick={closeModal} />
            )}
            {props.errorMessage && props.showRetryButton && (
              <Button
                icon={BsArrowRepeat}
                label="Retry"
                onClick={() => location.reload()}
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};
