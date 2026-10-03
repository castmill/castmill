import type { Cache } from './cache';

export type CacheBackend = Pick<
  Cache,
  | 'init'
  | 'list'
  | 'count'
  | 'get'
  | 'hasUrl'
  | 'set'
  | 'del'
  | 'invalidate'
  | 'clean'
  | 'close'
>;
