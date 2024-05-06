import { Device } from "../interfaces/device.interface";
import { SortOptions } from "@castmill/ui-common";

const baseUrl = "http://localhost:4000/dashboard";

export const DevicesService = {
  /**
   * Register Device.
   * 
   * @returns Device
   */
  async registerDevice(organizationId: string, name: string, pincode: string) {
    const response = await fetch(`${baseUrl}/organizations/${organizationId}/devices`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, pincode }),
    });

    if (response.status >= 200 && response.status < 300) {
      return (await response.json()) as Device;
    } else {
      let errMsg = "";
      try {
        const { errors } = await response.json();
        errMsg = `${errors.detail || response.statusText}`;
      } catch (error) {
        errMsg = `${response.statusText}`;
      }
      throw new Error(errMsg);
    }
  },

  /**
   * Fetch Devices.
   * 
   * @returns { page: number, data: Device[], total: number }
   */
  async fetchDevices(organizationId: string, page: number, page_size: number, sortOptions: SortOptions) {
    const query = new URLSearchParams({
      ...sortOptions,
      page_size: page_size.toString(),
      page: page.toString(),
    }).toString();

    const response = await fetch(`${baseUrl}/organizations/${organizationId}/devices?${query}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status >= 200 && response.status < 300) {
      return await response.json() as { data: Device[], count: number };
    } else {
      let errMsg = "";
      try {
        const { errors } = await response.json();
        errMsg = `${errors.detail || response.statusText}`;
      } catch (error) {
        errMsg = `${response.statusText}`;
      }
      throw new Error(errMsg);
    }
  }
}
