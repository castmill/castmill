import { Component, Show } from 'solid-js';
import { RouteSectionProps, useParams } from '@solidjs/router';
import { store } from '../store/store';

/**
 * Route parameters change before ProtectedRoute's store-sync effect runs.
 * Mount pages only after both agree, and discard organization-local state
 * (including pending requests and open dialogs) when the organization changes.
 */
export const organizationRoute = (
  Page: Component<RouteSectionProps>
): Component<RouteSectionProps> => {
  return (props) => {
    const params = useParams();
    return (
      <Show
        when={
          store.organizations.loaded &&
          params.orgId === store.organizations.selectedId &&
          params.orgId
        }
        keyed
      >
        {(_orgId) => <Page {...props} />}
      </Show>
    );
  };
};
