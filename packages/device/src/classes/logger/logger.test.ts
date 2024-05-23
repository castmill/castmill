import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, NullLogger, DivLogger, WebSocketLogger, ILogger } from './'; // Adjust paths as necessary
import { Socket } from 'phoenix'; // Mocked Phoenix

// Mocking HTML elements for DivLogger tests

// At the top of your test file
vi.spyOn(console, 'error').mockImplementation(() => {});

// Resetting mocks and restoring the original functionality (if needed) after each test
afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  const mockDiv = {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    firstChild: null,
    style: {},
    scrollTop: 0,
    scrollHeight: 100,
  };
  global.document.getElementById = vi.fn(() => mockDiv);
});

// Mock Phoenix Channel and Socket
vi.mock('phoenix', () => ({
  Socket: vi.fn().mockImplementation(() => ({
    channel: vi.fn().mockImplementation(() => ({
      join: vi.fn().mockReturnValue({
        receive: vi.fn().mockReturnThis(),
      }),
      push: vi.fn().mockReturnValue({
        receive: vi.fn().mockReturnThis(),
      }),
    })),
  })),
  Channel: vi.fn(),
}));

describe('NullLogger', () => {
  it('should not perform any operations', async () => {
    const logger = new NullLogger();
    await logger.log('info', 'This is a test log.');
    // No assertion is necessary; success is no error thrown
  });
});

describe('DivLogger', () => {
  let logger: DivLogger;
  let mockDiv: HTMLDivElement;

  beforeEach(() => {
    // Create a mock HTMLDivElement
    mockDiv = document.createElement('div');
    mockDiv.appendChild = vi.fn(mockDiv.appendChild.bind(mockDiv)); // Bind original function to keep normal behavior
    mockDiv.removeChild = vi.fn(mockDiv.removeChild.bind(mockDiv)); // Bind original function to keep normal behavior

    // Mock read-only properties using Object.defineProperty
    Object.defineProperty(mockDiv, 'scrollHeight', {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(mockDiv, 'scrollTop', { value: 0, writable: true });

    logger = new DivLogger(mockDiv, 3); // Instantiate logger with mock div and maxLogs set to 3
  });

  it('should append logs to the div', async () => {
    await logger.log('info', 'Test log entry');
    expect(mockDiv.appendChild).toHaveBeenCalled();
    expect(mockDiv.children.length).toBe(1); // Ensure a log entry was added
  });

  it('should respect the maximum log count', async () => {
    for (let i = 0; i < 5; i++) {
      // Log more than the max to trigger removals
      await logger.log('info', `Log ${i}`);
    }
    expect(mockDiv.children.length).toBe(3); // Max of 3 logs should be maintained
    expect(mockDiv.removeChild).toHaveBeenCalledTimes(2); // Two old logs should be removed
  });

  it('should scroll to bottom on new log', async () => {
    await logger.log('info', 'Ensure scroll to bottom');
    expect(mockDiv.scrollTop).toBe(mockDiv.scrollHeight);
  });
});

describe('Logger', () => {
  let logger: Logger;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    logger = new Logger();
    logger.setLogger(mockLogger); // Set the mock logger

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original functions after each test
  });

  it('should delegate log calls to the configured logger', async () => {
    await logger.info('Test info');
    expect(mockLogger.log).toHaveBeenCalledWith('info', 'Test info');

    await logger.warn('Test warning');
    expect(mockLogger.log).toHaveBeenCalledWith('warning', 'Test warning');

    await logger.error('Test error');
    expect(mockLogger.log).toHaveBeenCalledWith('error', 'Test error');

    await logger.debug('Test debug');
    expect(mockLogger.log).toHaveBeenCalledWith('debug', 'Test debug');

    await logger.critical('Test critical');
    expect(mockLogger.log).toHaveBeenCalledWith('critical', 'Test critical');

    await logger.trace('Test trace');
    expect(mockLogger.log).toHaveBeenCalledWith('trace', 'Test trace');
  });

  it('should handle logging errors gracefully', async () => {
    const errorLogger: ILogger = {
      log: vi.fn().mockRejectedValue(new Error('Logging failed')),
    };
    logger.setLogger(errorLogger);

    // Using async/await style for clearer syntax
    try {
      await logger.info('This should not throw');
    } catch (error) {
      // We do not expect an error to be thrown, so this block should ideally not execute
    }

    // Check if console.error was called correctly
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to log message:')
    );
  });
});
