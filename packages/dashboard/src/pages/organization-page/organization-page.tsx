import { useSearchParams } from '@solidjs/router';
import {
  Component,
  createEffect,
  createSignal,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';

import { Button, FormItem, TabItem, Tabs, useToast } from '@castmill/ui-common';
import { OrganizationMembersView } from './organization-members-view';
import { LogoSettings } from './logo-settings';
import { store, setStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { BsCheckLg } from 'solid-icons/bs';

import style from './organization-page.module.scss';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInvitationsView } from './organization-invitations-view';
import { useI18n } from '../../i18n';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useLocation } from '@solidjs/router';

const OrganizationPage: Component = () => {
  const params = useSearchParams();
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const { registerShortcutAction, unregisterShortcutAction } =
    useKeyboardShortcuts();
  const location = useLocation();

  const [name, setName] = createSignal(store.organizations.selectedName!);
  const [logoMediaId, setLogoMediaId] = createSignal<number | null>(
    store.organizations.data.find(
      (org) => org.id === store.organizations.selectedId
    )?.logo_media_id || null
  );
  const [previousOrgId, setPreviousOrgId] = createSignal(
    store.organizations.selectedId
  );

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  // Check if user can update organization settings
  const canEdit = () => canPerformAction('organizations', 'update');

  onMount(() => {
    // Register keyboard shortcut for search
    registerShortcutAction(
      'generic-search',
      () => {
        // Focus the search input in the currently active tab
        const searchInput = document.querySelector(
          '.search-input'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      () => location.pathname.includes('/organization')
    );
  });

  onCleanup(() => {
    unregisterShortcutAction('generic-search');
  });

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = t('validation.fieldRequired');
        } else if (value.length < 5) {
          error = t('validation.minLength', { min: 5 });
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    // Only reset the form when switching to a different organization
    if (store.organizations.selectedId !== previousOrgId()) {
      setName(store.organizations.selectedName);
      const currentOrg = store.organizations.data.find(
        (org) => org.id === store.organizations.selectedId
      );
      setLogoMediaId(currentOrg?.logo_media_id || null);
      setIsFormModified(false);
      setPreviousOrgId(store.organizations.selectedId);
    }
  });

  createEffect(() => {
    // Track if the name has been modified
    const hasModifiedName = name() !== store.organizations.selectedName;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    return (
      ![...errors().values()].some((e) => e) && isFormModified() && canEdit()
    );
  };

  const onSubmit = async (organization: { id: string; name: string }) => {
    try {
      await OrganizationsService.update(organization.id, {
        name: organization.name,
      });

      // Clear any existing errors on success
      setErrors(new Map());
      toast.success('Organization updated successfully');

      // Update the store with the new organization name
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === organization.id ? { ...org, name: organization.name } : org
        )
      );

      // Update the selectedName if this is the currently selected organization
      if (store.organizations.selectedId === organization.id) {
        setStore('organizations', 'selectedName', organization.name);
      }
    } catch (error: any) {
      // Handle validation errors from the server
      if (error.status === 422 && error.data?.errors) {
        // Set server-side validation errors
        const newErrors = new Map();
        if (error.data.errors.name) {
          // Errors come as arrays, join them with commas
          const nameErrors = Array.isArray(error.data.errors.name)
            ? error.data.errors.name
            : [error.data.errors.name];
          newErrors.set('name', nameErrors.join(', '));
        }
        setErrors(newErrors);
      } else {
        toast.error(
          t('organization.errors.updateOrganization', { error: String(error) })
        );
      }
    }
  };

  const resourcesTabs: TabItem[] = [
    {
      title: t('organization.users'),
      content: () => (
        <Show when={store.organizations.selectedId}>
          <OrganizationMembersView
            organizationId={store.organizations.selectedId!}
            organizationName={store.organizations.selectedName!}
            onRemove={() => {}}
          />
        </Show>
      ),
    },
    {
      title: t('organization.invitations'),
      content: () => (
        <Show
          when={canPerformAction('organizations', 'create')}
          fallback={
            <div class={style['permission-warning']}>
              {t('organization.noCreateOrganizations')}
            </div>
          }
        >
          <Show when={store.organizations.selectedId}>
            <OrganizationInvitationsView
              organizationId={store.organizations.selectedId!}
              onRemove={() => {}}
            />
          </Show>
        </Show>
      ),
    },
    // Settings tab for organization configuration
    {
      title: t('organization.settings'),
      content: () => (
        <Show when={store.organizations.selectedId}>
          <LogoSettings
            organizationId={store.organizations.selectedId!}
            currentLogoMediaId={logoMediaId() || undefined}
            onLogoUpdate={(newLogoMediaId) => setLogoMediaId(newLogoMediaId)}
            disabled={!canEdit()}
          />
        </Show>
      ),
    },
  ];

  return (
    <div class={style['organization-page']}>
      <div class={style['header']}>
        <h1>{t('sidebar.organization')}</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isFormValid()) {
              const team = await onSubmit({
                id: store.organizations.selectedId!,
                name: name(),
              });

              setIsFormModified(false);
            }
          }}
        >
          <div class={style['form-inputs']}>
            <FormItem
              label={t('common.name')}
              id="name"
              value={name()!}
              placeholder={t('organization.placeholderName')}
              disabled={!canEdit()}
              onInput={(value: string | number | boolean) => {
                const strValue = value as string;
                setName(strValue);
                validateField('name', strValue);
              }}
            >
              <div class="error">{errors().get('name')}</div>
            </FormItem>
            <Button
              label={t('organization.update')}
              type="submit"
              disabled={!isFormValid()}
              icon={BsCheckLg}
              color="success"
            />
          </div>
        </form>
      </div>
      <Tabs tabs={resourcesTabs} initialIndex={0} />
    </div>
  );
};

export default OrganizationPage;
