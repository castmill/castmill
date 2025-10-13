import { createSignal } from 'solid-js';
import { OrganizationRole } from '../../types/organization-role.type';
import { Button, Dropdown, FormItem } from '@castmill/ui-common';
import { useI18n } from '../../i18n';

import style from './organization-invite-form.module.scss';

export const OrganizationInviteForm = (props: {
  organizationId: string;
  onSubmit: (email: string, role: OrganizationRole) => void;
}) => {
  const { t } = useI18n();
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal<OrganizationRole>('member');

  const [errors, setErrors] = createSignal(new Map());
  const [isFormValid, setIsFormValid] = createSignal(false);

  const validateField = (field: string, value: string) => {
    if (field === 'email') {
      if (value.length === 0) {
        errors().set(field, t('organization.errors.emailRequired'));
      } else if (!value.match(/^[\w-]+@([\w-]+\.)+[\w-]{2,4}$/)) {
        errors().set(field, t('organization.errors.invalidEmail'));
      } else {
        errors().delete(field);
      }
    }

    setErrors(new Map(errors()));
    setIsFormValid(errors().size === 0);
  };

  {
    /* Adding a new member just requires a valid email address */
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (isFormValid()) {
          props.onSubmit(email(), role());
        }
      }}
    >
      <FormItem
        label={t('common.name')}
        id="name"
        value={email()!}
        placeholder={t('organization.enterMemberEmail')}
        onInput={(value: string | number | boolean) => {
          const strValue = value as string;
          setEmail(strValue);
          validateField('email', strValue);
        }}
      >
        <div class="error">{errors().get('email')}</div>
      </FormItem>
      <div class={style['form-input']}>
        <Dropdown
          label={t('organization.role')}
          items={[
            {
              name: t('organization.roleAdmin'),
              value: 'admin',
            },
            {
              name: t('organization.roleManager'),
              value: 'manager',
            },
            {
              name: t('organization.roleEditor'),
              value: 'editor',
            },
            {
              name: t('organization.rolePublisher'),
              value: 'publisher',
            },
            {
              name: t('organization.roleDeviceManager'),
              value: 'device_manager',
            },
            {
              name: t('organization.roleMember'),
              value: 'member',
            },
            {
              name: t('organization.roleGuest'),
              value: 'guest',
            },
          ]}
          defaultValue={role()}
          onSelectChange={(value: string | number | undefined) => {
            if (!value) {
              return;
            }
            setRole(value as OrganizationRole);
          }}
        />
      </div>
      <div class={style['form-actions']}>
        <Button
          label={t('common.add')}
          type="submit"
          disabled={!isFormValid()}
          color="primary"
        />
      </div>
    </form>
  );
};
