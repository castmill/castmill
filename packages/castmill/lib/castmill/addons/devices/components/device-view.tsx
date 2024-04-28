import { Component } from 'solid-js';
import { Device } from '../interfaces/device.interface';

// Modal component that will be used to display the device details and allow the user to edit the device
const DeviceView: Component<{ device: Device }> = ({ device }) => {
  return (
    <div class="device-details">
      <p>Name: {device.name}</p>
      <p>Online: {device.online}</p>
      <p>Location: {device.location}</p>
      <p>City: {device.city}</p>
      <p>Country: {device.country}</p>
      <p>IP: {device.ip}</p>
    </div>
  );
};

export default DeviceView;
