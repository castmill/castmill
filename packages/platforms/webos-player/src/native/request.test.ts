import { afterEach, describe, expect, it, vi } from 'vitest';
import { scapRequest, SCAP_REQUEST_TIMEOUT_MS } from './request';

describe('scapRequest', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves with the success value', async () => {
    await expect(scapRequest('test', (resolve) => resolve(42))).resolves.toBe(
      42
    );
  });

  it('rejects with the failure value', async () => {
    const error = { errorCode: 'X' };
    await expect(
      scapRequest('test', (_, reject) => reject(error))
    ).rejects.toBe(error);
  });

  it('rejects when the API throws', async () => {
    const error = new Error('missing');
    await expect(
      scapRequest('test', () => {
        throw error;
      })
    ).rejects.toBe(error);
  });

  it('rejects when SCAP never calls back', async () => {
    vi.useFakeTimers();
    const pending = scapRequest('test', () => {});
    const assertion = expect(pending).rejects.toThrow(
      'WebOS test request timed out'
    );
    await vi.advanceTimersByTimeAsync(SCAP_REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
