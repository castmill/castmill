import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserMachine } from './browser';

describe('BrowserMachine machine identifier', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('reuses the persisted identifier', async () => {
    localStorage.setItem('machineId', 'existing-id');
    expect(await new BrowserMachine().getMachineGUID()).toBe('existing-id');
  });

  it('generates a UUID without randomUUID on older or insecure browsers', async () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => {
        bytes[index] = index;
      });
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    const id = await new BrowserMachine().getMachineGUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(await new BrowserMachine().getMachineGUID()).toBe(id);
  });

  it('reports an unavailable random number generator', async () => {
    vi.stubGlobal('crypto', {});
    await expect(new BrowserMachine().getMachineGUID()).rejects.toThrow(
      'Secure random number generation is unavailable'
    );
  });
});
