import { Component, createSignal, createEffect } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';
import { AddonStore } from '../../common/interfaces/addon-store';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import './register-device.scss';

const pincodeLength = 10;

const RegisterDevice: Component<{
  pincode?: string;
  store?: AddonStore;
  onSubmit: (data: { name: string; pincode: string }) => void;
  onCancel: () => void;
  success?: boolean;
  onRegisterAnother?: () => void;
}> = (props) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal('');
  const [pincode, setPincode] = createSignal('');
  const [errors, setErrors] = createSignal(new Map());
  const [wasSuccess, setWasSuccess] = createSignal(false);

  if (props.pincode) {
    setPincode(props.pincode);
  }

  // Reset form when transitioning from success back to form state
  createEffect(() => {
    if (wasSuccess() && !props.success) {
      // Reset form fields
      setName('');
      if (!props.pincode) {
        setPincode('');
      }
      setErrors(new Map());
    }
    setWasSuccess(!!props.success);
  });

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    if (fieldId === 'name') {
      error = value ? '' : 'Name is required';
    } else if (fieldId === 'pincode') {
      error =
        value && value.length === pincodeLength
          ? ''
          : `Pincode must be ${pincodeLength} characters`;
    }
    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && name() && pincode();
  };

  return (
    <div>
      {props.success ? (
        // Success state - show success message with options
        <div class="success-content">
          <div class="success-buttons">
            {props.onRegisterAnother && (
              <Button
                label={t('devices.registerAnother')}
                onClick={props.onRegisterAnother}
                icon={BsCheckLg}
                color="success"
              />
            )}
          </div>
        </div>
      ) : (
        // Normal form state
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isFormValid()) {
              props.onSubmit({ name: name(), pincode: pincode() });
            }
          }}
        >
          <div class="form-inputs">
            <FormItem
              label={t('common.name')}
              id="name"
              value={name()}
              placeholder={t('devices.enterDeviceName')}
              onInput={(value: string) => {
                setName(value);
                validateField('name', value);
              }}
            >
              <div class="error">{errors().get('name')}</div>
            </FormItem>

            <FormItem
              label={t('devices.pincode')}
              id="pincode"
              value={pincode()}
              placeholder={t('devices.enterPincode', { length: pincodeLength })}
              disabled={!!props.pincode}
              description={t('devices.pincodeDescription')}
              onInput={(value: string) => {
                setPincode(value);
                validateField('pincode', value);
              }}
            >
              <div class="error">{errors().get('pincode')}</div>
            </FormItem>
          </div>
          <div class="bottom-buttons">
            <Button
              label={t('devices.register')}
              type="submit"
              disabled={!isFormValid()}
              icon={BsCheckLg}
              color="success"
            />
            <Button
              label={t('common.cancel')}
              onClick={props.onCancel}
              icon={BsX}
              color="danger"
            />
          </div>
        </form>
      )}
    </div>
  );
};
