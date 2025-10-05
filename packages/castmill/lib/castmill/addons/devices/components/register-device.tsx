import { Component, createSignal, createEffect } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import './register-device.scss';

const pincodeLength = 10;

const RegisterDevice: Component<{
  pincode?: string;
  onSubmit: (data: { name: string; pincode: string }) => void;
  onCancel: () => void;
  success?: boolean;
  onRegisterAnother?: () => void;
}> = (props) => {
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
                label="Register Another"
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
              label="Name"
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
      )}
    </div>
  );
};

export default RegisterDevice;
