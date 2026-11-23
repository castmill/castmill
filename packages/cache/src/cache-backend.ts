import type { Cache } from './cache';

export type CacheBackend = Pick<
  Cache,
  | 'init'
  | 'list'
  | 'count'
  | 'usage'
  | 'get'
  | 'hasUrl'
  | 'set'
  | 'del'
  | 'invalidate'
  | 'clean'
  | 'close'
>;
