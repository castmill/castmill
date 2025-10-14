# Channels Component - Test Specification

This document describes the test scenarios for the Channels component which handles multiple channel assignment to devices.

## Component Under Test

**File:** `packages/castmill/lib/castmill/addons/devices/components/channels.tsx`

## Test Scenarios

### 1. Channel Display and Fetching

#### Test: Should display assigned channels in a table
- **Given:** A device with multiple channels assigned
- **When:** The component loads
- **Then:** All assigned channels should be displayed in the TableView
- **Assertions:**
  - Table shows correct number of channels
  - Each channel displays ID, Name, and Timezone
  - Channels are fetched using `DevicesService.fetchChannelByDeviceId`

#### Test: Should handle empty channel list
- **Given:** A device with no channels assigned
- **When:** The component loads
- **Then:** An empty table should be displayed
- **Assertions:**
  - Table renders without errors
  - No channel rows are displayed

### 2. Adding Channels

#### Test: Should successfully add a channel to device
- **Given:** A device with existing channels
- **When:** User selects a new channel from ComboBox and confirms
- **Then:** The channel should be added and table should refresh
- **Assertions:**
  - `DevicesService.addChannelToDevice` is called with correct parameters
  - Table is refreshed to show the new channel
  - ComboBox selection is cleared

#### Test: Should prevent adding duplicate channels
- **Given:** A device with Channel A already assigned
- **When:** User tries to add Channel A again
- **Then:** An alert should inform the user and the operation should be prevented
- **Assertions:**
  - Alert message: "This channel is already assigned to the device."
  - `DevicesService.addChannelToDevice` is NOT called
  - Channel count remains unchanged

#### Test: Should show error message when adding channel fails
- **Given:** A device and a valid channel selection
- **When:** The API call fails (network error, server error, etc.)
- **Then:** An error alert should be displayed
- **Assertions:**
  - Alert message includes error details: "Failed to add channel: {error}"
  - Table is not refreshed
  - User can retry the operation

### 3. Removing Channels

#### Test: Should successfully remove a channel from device
- **Given:** A device with 3 channels assigned (Channel A, B, C)
- **When:** User clicks delete button for Channel B
- **Then:** Channel B should be removed and table should refresh
- **Assertions:**
  - `DevicesService.removeChannelFromDevice` is called with correct parameters
  - Table is refreshed and shows only 2 channels (A and C)
  - Delete button was clickable

#### Test: Should prevent removing the last channel
- **Given:** A device with only 1 channel assigned
- **When:** User hovers over or tries to click the delete button
- **Then:** The delete button should be disabled with explanatory tooltip
- **Assertions:**
  - Delete button has `disabled={true}`
  - Tooltip displays: "Cannot delete the last remaining channel."
  - `DevicesService.removeChannelFromDevice` is NOT called
  - Alert message: "At least one channel must be assigned to the device."

#### Test: Should show error message when removing channel fails
- **Given:** A device with multiple channels
- **When:** The API call to remove a channel fails
- **Then:** An error alert should be displayed
- **Assertions:**
  - Alert message includes error details: "Failed to remove channel: {error}"
  - Table is not refreshed
  - Channel remains visible in the list

### 4. Multiple Channel Management

#### Test: Should handle multiple channels correctly
- **Given:** A device with 5 channels assigned
- **When:** The component loads
- **Then:** All 5 channels should be displayed with proper pagination
- **Assertions:**
  - TableView shows 5 channels per page (itemsPerPage setting)
  - Each channel has a working delete button (except if only 1 remains)
  - Channel data includes all required fields

#### Test: Should maintain state after adding/removing channels
- **Given:** A device with channels [A, B, C]
- **When:** User removes B, then adds D
- **Then:** The final state should show [A, C, D]
- **Assertions:**
  - Each operation refreshes the table correctly
  - Channel order is maintained
  - No duplicate channels appear

### 5. UI Interactions

#### Test: Should disable delete button for last channel
- **Given:** A device with only 1 channel
- **When:** Component renders
- **Then:** Delete button should be disabled and show tooltip
- **Assertions:**
  - Button has `disabled` attribute
  - Tooltip shows explanatory message
  - Button styling indicates disabled state

#### Test: Should enable delete buttons when multiple channels exist
- **Given:** A device with 2+ channels
- **When:** Component renders
- **Then:** All delete buttons should be enabled
- **Assertions:**
  - Each delete button is clickable
  - No disabled attribute on buttons
  - Tooltip is not shown (or shows regular "Remove" text)

### 6. Error Handling

#### Test: Should handle network failures gracefully
- **Given:** Network connectivity issues
- **When:** User attempts to add or remove a channel
- **Then:** User-friendly error message should be displayed
- **Assertions:**
  - Alert displays the error message
  - Component remains functional
  - User can retry the operation

#### Test: Should handle backend validation errors
- **Given:** Backend returns validation error (e.g., channel doesn't exist)
- **When:** User attempts to add a channel
- **Then:** Specific error message should be displayed
- **Assertions:**
  - Error message from backend is shown to user
  - Component state remains consistent
  - Table is not corrupted

## Integration Points

### API Endpoints Tested

1. **POST** `/dashboard/devices/{deviceId}/channels`
   - Adds a channel to a device
   - Body: `{ channel_id: number }`
   - Expected responses:
     - 200: Success
     - 400: Duplicate channel or validation error
     - 500: Server error

2. **DELETE** `/dashboard/devices/{deviceId}/channels/{channelId}`
   - Removes a channel from a device
   - Expected responses:
     - 200: Success
     - 400: Cannot remove last channel
     - 404: Channel not found
     - 500: Server error

3. **GET** `/dashboard/devices/{deviceId}/channels`
   - Fetches all channels assigned to a device
   - Returns: `{ data: JsonChannel[] }`
   - Expected responses:
     - 200: Success with channel array
     - 404: Device not found
     - 500: Server error

### DevicesService Methods Tested

- `addChannelToDevice(baseUrl, deviceId, channelId)` - See unit tests
- `removeChannelFromDevice(baseUrl, deviceId, channelId)` - See unit tests
- `fetchChannelByDeviceId(baseUrl, deviceId)` - See unit tests
- `fetchChannels(baseUrl, organizationId, opts)` - Used by ComboBox

## Test Implementation Status

- ✅ **Backend (Elixir):** Comprehensive unit tests in `test/castmill/devices_test.exs`
  - Multiple channel assignment
  - Duplicate prevention
  - Channel removal with multiple channels
  
- ✅ **Service Layer (TypeScript):** Unit tests in `devices.service.test.ts`
  - API method calls
  - Error handling
  - Request/response validation

- ⚠️ **Component (SolidJS):** Integration/E2E tests recommended
  - Component is embedded in Phoenix LiveView
  - Requires Elixir test infrastructure or E2E testing framework
  - Manual testing performed ✅

## Manual Testing Checklist

- [x] Add first channel to device
- [x] Add multiple channels to device
- [x] Try to add duplicate channel (should show alert)
- [x] Remove channel when multiple exist
- [x] Try to remove last channel (button should be disabled)
- [x] Verify tooltip on disabled delete button
- [x] Verify table refreshes after add/remove operations
- [x] Verify ComboBox shows available channels
- [x] Verify error handling for network failures
- [x] Verify pagination works with many channels

## Notes

The Channels component is a SolidJS component embedded within an Elixir/Phoenix application. While unit testing the component directly would require setting up a TypeScript test environment within the castmill package (currently not configured), the comprehensive backend tests and service layer tests provide good coverage of the functionality.

For full UI testing, consider:
1. Adding E2E tests using Playwright or Cypress
2. Setting up Vitest/Solid Testing Library in the castmill package
3. Continuing with manual testing for UI interactions
