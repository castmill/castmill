import { useSearchParams } from '@solidjs/router';
import { Component, createEffect, createSignal, Show } from 'solid-js';

import { Button, FormItem, TabItem, Tabs } from '@castmill/ui-common';
import { OrganizationMembersView } from './organization-members-view';
import { store } from '../../store';
import { BsCheckLg } from 'solid-icons/bs';

import style from './organization-page.module.scss';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInvitationsView } from './organization-invitations-view';
import { useI18n } from '../../i18n';

const OrganizationPage: Component = () => {
  const params = useSearchParams();
  const { t } = useI18n();

  const [name, setName] = createSignal(store.organizations.selectedName!);

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

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
    // We need to check both fields or create effect will not detect the dependencies.
    const hasModifiedName = name() !== store.organizations.selectedName;
    setIsFormModified(hasModifiedName);

    if (store.organizations.selectedId) {
      setName(store.organizations.selectedName);
    }
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  const onSubmit = async (organization: { id: string; name: string }) => {
    try {
      await OrganizationsService.update(organization.id, {
        name: organization.name,
      });
    } catch (error) {
      alert(t('organization.errors.updateOrganization', { error: String(error) }));
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
