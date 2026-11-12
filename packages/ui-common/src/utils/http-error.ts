export class HttpError<TDetails = unknown> extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: TDetails
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Whether a request failed because the organization's quota for the resource
 * is used up (the API answers `{ error: "quota_exceeded" }`).
 */
export const isQuotaExceededError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'quota_exceeded';
