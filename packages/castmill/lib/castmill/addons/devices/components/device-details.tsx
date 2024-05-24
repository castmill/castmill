import { createSignal, createEffect } from 'solid-js';

import { Device } from '../interfaces/device.interface';
import { Button, FormItem } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';

export interface DeviceUpdate {
  name: string;
  description: string;
}

// Optionally we should allow using protonmaps
// https://protomaps.com/

export const DeviceDetails = (props: {
  device: Device;
  onSubmit: (device: DeviceUpdate) => Promise<boolean>;
}) => {
  const [name, setName] = createSignal(props.device.name);
  const [description, setDescription] = createSignal(props.device.description);
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const [onlineStatus, setOnlineStatus] = createSignal('');

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
      case 'description':
        if (value && value.length < 5) {
          error = 'Description must be at least 5 characters';
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
    const hasModifiedName = name() !== props.device.name;
    const hasModifiedDescription = description() !== props.device.description;
    setIsFormModified(hasModifiedName || hasModifiedDescription);

    setOnlineStatus(
      props.device.online
        ? 'Yes'
        : `No, last seen on ${props.device.last_online}`
    );
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  return (
    <>
      <div style="font-size: 0.8em; color: darkgray;">
        <span>Added on </span> <span>{`${props.device.inserted_at}`}. </span>
        <span>Last updated on </span>
        <span>{`${props.device.updated_at}`}</span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isFormValid()) {
            if (
              await props.onSubmit({ name: name(), description: description() })
            ) {
              setIsFormModified(false);
            }
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
            label="Description"
            id="description"
            value={description()}
            placeholder="Enter a description"
            onInput={(value: string) => {
              setDescription(value);
              validateField('description', value);
            }}
          >
            <div class="error">{errors().get('description')}</div>
          </FormItem>

          <FormItem
            label="Online"
            id="online"
            value={onlineStatus()}
            disabled={true}
          ></FormItem>

          <FormItem
            label="IP"
            id="last_ip"
            value={props.device.last_ip}
            disabled={true}
          ></FormItem>
        </div>
        <div class="bottom-buttons">
          <Button
            label="Update"
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label="Reset"
            onClick={() => {
              setName(props.device.name);
              setDescription(props.device.description);
              setIsFormModified(false);
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </>
  );
};
