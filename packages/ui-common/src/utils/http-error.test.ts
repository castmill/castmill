import { describe, it, expect } from 'vitest';
import { HttpError, isQuotaExceededError } from './http-error';

describe('isQuotaExceededError', () => {
  it('recognizes quota errors from any request helper', () => {
    expect(isQuotaExceededError(new HttpError('quota_exceeded', 403))).toBe(
      true
    );
    expect(isQuotaExceededError(new Error('quota_exceeded'))).toBe(true);
  });

  it('ignores other errors and values', () => {
    expect(isQuotaExceededError(new HttpError('Forbidden', 403))).toBe(false);
    expect(isQuotaExceededError('quota_exceeded')).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});
