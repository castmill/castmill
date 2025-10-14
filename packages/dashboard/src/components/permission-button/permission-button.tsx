/**
 * Permission-Aware Button Component
 *
 * A button that automatically disables itself based on user permissions.
 * The button will be disabled if the user doesn't have permission to perform the action.
 */

import { Component, ComponentProps } from 'solid-js';
import { Button } from '@castmill/ui-common';
import type { IconTypes } from 'solid-icons';
import { usePermissions } from '../../hooks/usePermissions';
import type { ResourceType, Action } from '../../services/permissions.service';

interface PermissionButtonProps extends ComponentProps<typeof Button> {
  /**
   * The resource type this action applies to (e.g., 'playlists', 'teams')
   */
  resource: ResourceType;

  /**
   * The action to perform (e.g., 'create', 'update', 'delete')
   */
  action: Action;

  /**
   * Optional: Force disable even if user has permission
   */
  forceDisabled?: boolean;

  /**
   * Accessible label rendered by the underlying button component
   */
  label?: string;

  /**
   * Click handler forwarded to the underlying button component
   */
  onClick?: ComponentProps<typeof Button>['onClick'];

  /**
   * Optional icon rendered before the label
   */
  icon?: IconTypes;

  /**
   * Visual intent of the button (defaults to primary)
   */
  color?: ComponentProps<typeof Button>['color'];
}

export const PermissionButton: Component<PermissionButtonProps> = (props) => {
  const { canPerformAction } = usePermissions();

  const hasPermission = () => canPerformAction(props.resource, props.action);
  const isDisabled = () => props.forceDisabled || !hasPermission();

  // Destructure to remove custom props before passing to Button
  const { resource, action, forceDisabled, ...buttonProps } = props;

  return <Button {...buttonProps} disabled={isDisabled()} />;
};
