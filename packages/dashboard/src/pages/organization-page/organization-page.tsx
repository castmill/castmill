import { useSearchParams } from '@solidjs/router';
import { Component, createEffect, createSignal, Show } from 'solid-js';

import { Button, FormItem, TabItem, Tabs, useToast } from '@castmill/ui-common';
import { OrganizationMembersView } from './organization-members-view';
import { store, setStore } from '../../store';
import { BsCheckLg } from 'solid-icons/bs';

import style from './organization-page.module.scss';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInvitationsView } from './organization-invitations-view';

const OrganizationPage: Component = () => {
  const params = useSearchParams();
  const toast = useToast();

  const [name, setName] = createSignal(store.organizations.selectedName!);
  const [previousOrgId, setPreviousOrgId] = createSignal(
    store.organizations.selectedId
  );

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = 'Name is required';
        } else if (value.length < 5) {
          error = 'Name must be at least 5 characters';
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
    return ![...errors().values()].some((e) => e) && isFormModified();
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
        toast.error(`Error updating organization: ${error.message}`);
      }
    }
  };

  const resourcesTabs: TabItem[] = [
    {
      title: 'Users',
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
      title: 'Invitations',
      content: () => (
        <Show when={store.organizations.selectedId}>
          <OrganizationInvitationsView
            organizationId={store.organizations.selectedId!}
            onRemove={() => {}}
          />
        </Show>
      ),
    },
  ];

  return (
    <div class={style['organization-page']}>
      <div class={style['header']}>
        <h1>Organization</h1>
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
              label="Name"
              id="name"
              value={name()!}
              placeholder="Enter organization name"
              onInput={(value: string | number | boolean) => {
                const strValue = value as string;
                setName(strValue);
                validateField('name', strValue);
              }}
            >
              <div class="error">{errors().get('name')}</div>
            </FormItem>
            <Button
              label="Update"
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
