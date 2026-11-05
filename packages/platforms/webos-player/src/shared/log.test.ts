import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from './log';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('WebOS logging', () => {
  it.each(['true', 'false'])(
    'gates every level with VITE_LOGGING=%s',
    (flag) => {
      vi.stubEnv('VITE_LOGGING', flag);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger('WebOS');
      expect(logger.enabled).toBe(flag === 'true');
      logger.log('hello', 1);
      logger.warn('warning');
      logger.error('failure');
      if (flag === 'true') {
        expect(log).toHaveBeenCalledWith('[WebOS] hello 1');
        expect(warn).toHaveBeenCalledWith('[WebOS] warning');
        expect(error).toHaveBeenCalledWith('[WebOS] failure');
      } else {
        expect(log).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      }
    }
  );
});
