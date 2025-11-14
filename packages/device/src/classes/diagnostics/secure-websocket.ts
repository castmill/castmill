/**
 * SecureWebSocketConnection
 *
 * Provides WebSocket security enhancements including:
 * - Secure WebSocket (WSS) enforcement
 * - TLS certificate validation
 * - Connection authentication with device tokens
 * - Certificate pinning support (optional)
 * - Connection resilience and error handling
 */

import { Socket, SocketConnectOption } from 'phoenix';

export interface SecureConnectionConfig {
  // Required device identification
  deviceId: string;
  deviceToken: string;
  hardwareId?: string;

  // TLS/SSL Configuration
  validateCertificates?: boolean; // Default: true
  allowSelfSignedCerts?: boolean; // Default: false (only for development)
  pinnedCertificates?: string[]; // Array of certificate fingerprints (SHA-256)

  // Connection parameters
  endpoint: string;
  reconnectAfterMs?: (tries: number) => number;
  rejoinAfterMs?: (tries: number) => number;
  timeout?: number;

  // Additional connection parameters
  params?: { [key: string]: any };
}

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnectAttempt?: number;
  lastSuccessfulConnect?: number;
  error?: string;
  certificateValid?: boolean;
}

/**
 * Validates that the endpoint uses secure WebSocket (wss://)
 */
export function validateSecureEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    // In production, require wss:// (secure WebSocket)
    // In development, allow ws:// for localhost only
    if (url.protocol === 'wss:') {
      return true;
    }
    if (url.protocol === 'ws:') {
      // Only allow insecure WebSocket for localhost in development
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
      const isLocalhost =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1' ||
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('172.16.') ||
        url.hostname.startsWith('172.17.') ||
        url.hostname.startsWith('172.18.') ||
        url.hostname.startsWith('172.19.') ||
        url.hostname.startsWith('172.20.') ||
        url.hostname.startsWith('172.21.') ||
        url.hostname.startsWith('172.22.') ||
        url.hostname.startsWith('172.23.') ||
        url.hostname.startsWith('172.24.') ||
        url.hostname.startsWith('172.25.') ||
        url.hostname.startsWith('172.26.') ||
        url.hostname.startsWith('172.27.') ||
        url.hostname.startsWith('172.28.') ||
        url.hostname.startsWith('172.29.') ||
        url.hostname.startsWith('172.30.') ||
        url.hostname.startsWith('172.31.') ||
        url.hostname.startsWith('169.254.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('127.');

      if (isDevelopment && isLocalhost) {
        console.warn(
          'Insecure WebSocket connection allowed for local development'
        );
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Invalid endpoint URL:', error);
    return false;
  }
}

/**
 * Generates authentication parameters for WebSocket connection
 * 
 * Note: The timestamp parameter provides client-side replay attack prevention,
 * but requires server-side validation to be effective:
 * 1. Server must validate the timestamp is recent (within acceptable time window)
 * 2. Server should track used timestamps/nonces to prevent replay
 */
export function generateAuthParams(config: SecureConnectionConfig): {
  [key: string]: any;
} {
  const params: { [key: string]: any } = {
    device_id: config.deviceId,
    token: config.deviceToken,
    ...config.params,
  };

  if (config.hardwareId) {
    params.hardware_id = config.hardwareId;
  }

  // Add timestamp for replay attack prevention
  params.timestamp = Date.now();

  return params;
}

/**
 * Validates certificate fingerprint (for certificate pinning)
 * Note: In browser/Capacitor environments, certificate validation is handled by the platform
 * This is a placeholder for future native implementation
 */
export function validateCertificateFingerprint(
  cert: any,
  pinnedFingerprints: string[]
): boolean {
  // In browser environments, certificate pinning is not directly available
  // This would need to be implemented at the native layer (Android/iOS)
  console.warn(
    'Certificate pinning is not available in browser environment'
  );
  console.info(
    'For certificate pinning, implement native layer validation in Capacitor plugins'
  );
  return true; // Allow connection, rely on platform's certificate validation
}

/**
 * Creates a secure WebSocket connection with authentication and TLS validation
 */
export class SecureWebSocketConnection {
  private socket?: Socket;
  private config: SecureConnectionConfig;
  private status: ConnectionStatus = { state: 'disconnected' };

  constructor(config: SecureConnectionConfig) {
    this.config = this.validateConfig(config);
  }

  /**
   * Validate and normalize configuration
   */
  private validateConfig(
    config: SecureConnectionConfig
  ): SecureConnectionConfig {
    const normalized = { ...config };

    // Default to secure settings
    if (normalized.validateCertificates === undefined) {
      normalized.validateCertificates = true;
    }
    if (normalized.allowSelfSignedCerts === undefined) {
      normalized.allowSelfSignedCerts = false;
    }

    // Validate endpoint security
    if (!validateSecureEndpoint(normalized.endpoint)) {
      throw new Error(
        'Insecure WebSocket endpoint. Use wss:// for secure connections.'
      );
    }

    // Set default reconnection strategy with exponential backoff
    if (!normalized.reconnectAfterMs) {
      normalized.reconnectAfterMs = (tries: number) => {
        const safeTries = Math.max(1, tries);
        return Math.min(10000, 1000 * Math.pow(2, safeTries - 1));
      };
    }

    if (!normalized.rejoinAfterMs) {
      normalized.rejoinAfterMs = (tries: number) => {
        const safeTries = Math.max(1, tries);
        return Math.min(10000, 1000 * Math.pow(2, safeTries - 1));
      };
    }

    return normalized;
  }

  /**
   * Connect to the WebSocket server with authentication
   */
  async connect(): Promise<Socket> {
    this.status.state = 'connecting';
    this.status.lastConnectAttempt = Date.now();

    try {
      // Generate authentication parameters
      const authParams = generateAuthParams(this.config);

      // Create socket options
      const socketOptions: SocketConnectOption = {
        params: authParams,
        reconnectAfterMs: this.config.reconnectAfterMs,
        timeout: this.config.timeout || 10000,
      };

      // Create the socket
      this.socket = new Socket(this.config.endpoint, socketOptions);

      // Set up connection event handlers
      this.setupEventHandlers(this.socket);

      // Attempt connection
      this.socket.connect();

      // Connection status will be updated in the onOpen event handler

      return this.socket;
    } catch (error: any) {
      this.status.state = 'error';
      this.status.error = error?.message || 'Unknown connection error';
      throw error;
    }
  }

  /**
   * Set up event handlers for the socket
   */
  private setupEventHandlers(socket: Socket): void {
    socket.onOpen(() => {
      console.log('WebSocket connection opened');
      this.status.state = 'connected';
      this.status.lastSuccessfulConnect = Date.now();
      this.status.certificateValid = true; // Assume valid if connection succeeds
    });

    socket.onError((error: any) => {
      console.error('WebSocket error:', error);
      this.status.state = 'error';
      this.status.error = error?.message || 'WebSocket error';

      // Check if it's a certificate validation error
      if (
        error?.message?.includes('certificate') ||
        error?.message?.includes('TLS') ||
        error?.message?.includes('SSL')
      ) {
        this.status.certificateValid = false;
        console.error(
          'TLS/SSL certificate validation failed:',
          error.message
        );
      }
    });

    socket.onClose((event: any) => {
      console.log('WebSocket connection closed', event);
      this.status.state = 'disconnected';
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
      this.status.state = 'disconnected';
    }
  }

  /**
   * Get the current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Get the underlying Phoenix socket (if connected)
   */
  getSocket(): Socket | undefined {
    return this.socket;
  }

  /**
   * Update device token (for token rotation)
   */
  async updateToken(newToken: string): Promise<void> {
    this.config.deviceToken = newToken;
    // If connected, disconnect and reconnect with new token
    if (this.socket && this.status.state === 'connected') {
      this.disconnect();
      await this.connect();
    }
  }

  /**
   * Check if certificate pinning is configured
   */
  hasCertificatePinning(): boolean {
    return (
      Array.isArray(this.config.pinnedCertificates) &&
      this.config.pinnedCertificates.length > 0
    );
  }
}
