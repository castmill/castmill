import { Component } from 'solid-js';
import { AiOutlineLock } from 'solid-icons/ai';
import styles from './permission-denied.module.scss';

interface PermissionDeniedProps {
  /**
   * The name of the resource the user tried to access
   */
  resource?: string;
  /**
   * Optional custom message
   */
  message?: string;
}

/**
 * Component to display when user lacks permissions to access a resource.
 * Shows a user-friendly message instead of technical 403 error.
 */
export const PermissionDenied: Component<PermissionDeniedProps> = (props) => {
  const defaultMessage = () => {
    if (props.resource) {
      return `You don't have permission to access ${props.resource}.`;
    }
    return "You don't have permission to access this resource.";
  };

  return (
    <div class={styles.permissionDenied}>
      <div class={styles.iconContainer}>
        <AiOutlineLock class={styles.icon} />
      </div>
      <h2 class={styles.title}>Access Restricted</h2>
      <p class={styles.message}>{props.message || defaultMessage()}</p>
      <p class={styles.hint}>
        Contact your organization administrator if you need access to this
        resource.
      </p>
    </div>
  );
};
