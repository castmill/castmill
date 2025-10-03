import { Component, createSignal } from 'solid-js';
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
}> = (props) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal('');
  const [pincode, setPincode] = createSignal('');
  const [errors, setErrors] = createSignal(new Map());

  if (props.pincode) {
    setPincode(props.pincode);
  }

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
            placeholder="Enter device name"
            onInput={(value: string) => {
              setName(value);
              validateField('name', value);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>

          <FormItem
            label="Pincode"
            id="pincode"
            value={pincode()}
            placeholder={`Enter ${pincodeLength}-characters pincode`}
            disabled={!!props.pincode}
            description="The pincode will be shown on the device's screen."
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
            label="Register"
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label="Cancel"
            onClick={props.onCancel}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </div>
  );
};

export default RegisterDevice;
