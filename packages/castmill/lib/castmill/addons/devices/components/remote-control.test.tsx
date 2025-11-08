/**
 * Tests for RemoteControl component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { RemoteControl } from './remote-control';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

// Mock the DevicesService
vi.mock('../services/devices.service', () => ({
  DevicesService: {
    startRemoteControlSession: vi.fn(),
  },
}));

// Mock @castmill/ui-common
vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      data-testid="button"
    >
      {props.label}
    </button>
  ),
  FormItem: (props: any) => <div>{props.children}</div>,
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock window.open
const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;

describe('RemoteControl Component', () => {
  const baseUrl = 'http://test.com';
  const organizationId = 'org-123';
  const mockDeviceOnline: Device = {
    id: 'device-123',
    name: 'Test Device',
    description: 'Test description',
    online: true,
    last_online: new Date('2024-01-01'),
    location: 'Test Location',
    city: 'Test City',
    country: 'Test Country',
    last_ip: '192.168.1.1',
    inserted_at: new Date('2023-01-01'),
    updated_at: new Date('2023-12-01'),
    log_level: 'info',
  };

  const mockDeviceOffline: Device = {
    ...mockDeviceOnline,
    online: false,
  };

  const mockT = (key: string, params?: Record<string, any>) => {
    const translations: Record<string, string> = {
      'devices.remoteControl.auto': 'Auto',
      'devices.remoteControl.online': 'Online',
      'devices.remoteControl.offline': 'Offline',
      'devices.remoteControl.now': 'Now',
      'devices.remoteControl.status': 'Status',
      'devices.remoteControl.lastCheckIn': 'Last Check-In',
      'devices.remoteControl.activeSession': 'Active Session',
      'devices.remoteControl.sessionSettings': 'Session Settings',
      'devices.remoteControl.resolution': 'Resolution',
      'devices.remoteControl.fps': 'FPS',
      'devices.remoteControl.startSession': 'Start RC Session',
      'devices.remoteControl.sessionStarted': 'Remote control session started',
      'devices.remoteControl.sessionStartError': `Failed to start remote control session: ${params?.error || 'error'}`,
      'devices.remoteControl.deviceOfflineError':
        'Cannot start session - device is offline',
      'common.no': 'No',
    };
    return translations[key] || key;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  describe('Rendering', () => {
    it('should render status section for online device', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('Last Check-In')).toBeInTheDocument();
      expect(screen.getByText('Now')).toBeInTheDocument();
    });

    it('should render status section for offline device', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOffline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should render session settings section', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      expect(screen.getByText('Session Settings')).toBeInTheDocument();
      expect(screen.getByText('Resolution')).toBeInTheDocument();
      expect(screen.getByText('FPS')).toBeInTheDocument();
      expect(screen.getByText('Start RC Session')).toBeInTheDocument();
    });

    it('should render resolution selector with correct options', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const resolutionSelect = screen.getByLabelText('Resolution');
      expect(resolutionSelect).toBeInTheDocument();
      expect(resolutionSelect).toHaveValue('auto');
    });

    it('should render FPS selector with correct options', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const fpsSelect = screen.getByLabelText('FPS');
      expect(fpsSelect).toBeInTheDocument();
      expect(fpsSelect).toHaveValue('auto');
    });
  });

  describe('Interaction', () => {
    it('should enable start button for online device', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const startButton = screen.getByTestId('button');
      expect(startButton).not.toBeDisabled();
    });

    it('should disable start button for offline device', () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOffline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const startButton = screen.getByTestId('button');
      expect(startButton).toBeDisabled();
    });

    it('should change resolution when selector is changed', async () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const resolutionSelect = screen.getByLabelText('Resolution') as HTMLSelectElement;
      fireEvent.input(resolutionSelect, { target: { value: '720p' } });

      await waitFor(() => {
        expect(resolutionSelect.value).toBe('720p');
      });
    });

    it('should change FPS when selector is changed', async () => {
      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const fpsSelect = screen.getByLabelText('FPS') as HTMLSelectElement;
      fireEvent.input(fpsSelect, { target: { value: '30' } });

      await waitFor(() => {
        expect(fpsSelect.value).toBe('30');
      });
    });
  });

  describe('Starting Remote Control Session', () => {
    it('should call startRemoteControlSession with correct parameters', async () => {
      const mockSessionData = {
        session_id: 'session-123',
        url: 'ws://test.com/rc/session-123',
      };
      
      (DevicesService.startRemoteControlSession as any).mockResolvedValueOnce(
        mockSessionData
      );

      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const startButton = screen.getByTestId('button');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(DevicesService.startRemoteControlSession).toHaveBeenCalledWith(
          baseUrl,
          mockDeviceOnline.id,
          'auto',
          0
        );
      });
    });

    it('should open popup window with correct URL when session starts', async () => {
      const mockSessionData = {
        session_id: 'session-123',
        url: 'ws://test.com/rc/session-123',
      };
      
      (DevicesService.startRemoteControlSession as any).mockResolvedValueOnce(
        mockSessionData
      );

      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const startButton = screen.getByTestId('button');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          `/org/${organizationId}/devices/${mockDeviceOnline.id}/remote-control?session=session-123`,
          'RemoteControl',
          expect.stringContaining('width=1024')
        );
      });
    });

    it('should use selected resolution and FPS values', async () => {
      const mockSessionData = {
        session_id: 'session-456',
        url: 'ws://test.com/rc/session-456',
      };
      
      (DevicesService.startRemoteControlSession as any).mockResolvedValueOnce(
        mockSessionData
      );

      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const resolutionSelect = screen.getByLabelText('Resolution') as HTMLSelectElement;
      const fpsSelect = screen.getByLabelText('FPS') as HTMLSelectElement;
      
      fireEvent.input(resolutionSelect, { target: { value: '720p' } });
      fireEvent.input(fpsSelect, { target: { value: '30' } });

      const startButton = screen.getByTestId('button');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(DevicesService.startRemoteControlSession).toHaveBeenCalledWith(
          baseUrl,
          mockDeviceOnline.id,
          '720p',
          30
        );
      });
    });

    it('should handle errors when starting session fails', async () => {
      const mockError = new Error('Device is offline');
      (DevicesService.startRemoteControlSession as any).mockRejectedValueOnce(
        mockError
      );

      render(() => (
        <RemoteControl
          baseUrl={baseUrl}
          device={mockDeviceOnline}
          organizationId={organizationId}
          t={mockT}
        />
      ));

      const startButton = screen.getByTestId('button');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockWindowOpen).not.toHaveBeenCalled();
      });
    });
  });
});
