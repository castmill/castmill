import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourcesObserver } from './resources-observer';
import { Socket } from 'phoenix';

// Adjust mock setup
vi.mock('phoenix', () => {
  const mockChannel = () => ({
    on: vi.fn(),
    off: vi.fn(),
    leave: vi.fn(),
    join: vi.fn()
  });

  return {
    Socket: vi.fn().mockImplementation((endPoint: string) => ({
      channel: vi.fn().mockImplementation((topic: string) => mockChannel())
    }))
  };
});

describe('ResourcesObserver', () => {
  let observer: ResourcesObserver<{ id: string }>;
  let mockSocket: any;
  let onJoin: vi.Mock;
  let onUpdate: vi.Mock;

  beforeEach(() => {
    mockSocket = new Socket('ws://example.com/socket');
    onJoin = vi.fn((resource) => `topic:${resource.id}`);
    onUpdate = vi.fn();
    observer = new ResourcesObserver(mockSocket, 'updateRoom', onJoin, onUpdate);
  });

  it('should create and join new channels for new resources', () => {
    const resources = [{ id: '1' }, { id: '2' }];
    observer.observe(resources);
    expect(mockSocket.channel).toHaveBeenCalledTimes(2);
    expect(mockSocket.channel).toHaveBeenCalledWith('topic:1');
    expect(mockSocket.channel).toHaveBeenCalledWith('topic:2');

    // Checking if `join` has been called on each channel instance
    const allChannels = mockSocket.channel.mock.results.map(result => result.value);
    allChannels.forEach(channel => {
      expect(channel.join).toHaveBeenCalledTimes(1);
    });
  });

  it('should clean up channels not in the new resources list', () => {
    const resources1 = [{ id: '1' }];
    const resources2 = [{ id: '2' }];

    observer.observe(resources1);
    observer.observe(resources2);

    const firstChannel = mockSocket.channel.mock.results[0].value;
    expect(firstChannel.off).toHaveBeenCalledWith('updateRoom');
    expect(firstChannel.leave).toHaveBeenCalled();
  });

  it('should unsubscribe and leave all channels on cleanup', () => {
    const resources = [{ id: '1' }];
    observer.observe(resources);
    observer.cleanup();
    const channel = mockSocket.channel.mock.results[0].value;
    expect(channel.leave).toHaveBeenCalled();
  });
});
