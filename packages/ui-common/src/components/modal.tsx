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
import { BsX, BsCheckLg, BsArrowRepeat } from 'solid-icons/bs';
import { IconButton } from './icon-button';
import { Button } from './button';

import './modal.scss';

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
}

const animationDuration = 300;

export const Modal: Component<ModalProps> = (props) => {
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
    }, animationDuration); // This should match the CSS transition duration
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
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

    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    closeModal();
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Automatically close the modal after a success message, if specified
  createEffect(() => {
    if (props.successMessage && props.autoCloseDelay) {
      const timer = setTimeout(props.onClose, props.autoCloseDelay);
      return () => clearTimeout(timer);
    }
  });

  return (
    <Portal mount={document.body}>
      <div
        data-testid="modal-overlay"
        class={`modal-overlay ${isActive() ? 'active' : ''}`}
        onClick={closeModalOnOverlayClick}
      >
        <div
          class={`modal-content ${isActive() ? 'active' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="modal-header">
            <div class="title">
              <h2>{props.title}</h2>
              <h3>{props.description}</h3>
            </div>
            <IconButton icon={BsX} onClick={props.onClose} color="secondary" />
          </div>
          {props.successMessage && (
            <div class="modal-success">{props.successMessage}</div>
          )}
          {props.errorMessage && (
            <div class="modal-error">{props.errorMessage}</div>
          )}
          <div class="modal-body">{props.children}</div>
          {isLoading() && <div class="modal-loading">Loading...</div>}
          <div class="modal-footer">
            {props.successMessage && (
              <Button icon={BsCheckLg} label="Close" onClick={props.onClose} />
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
