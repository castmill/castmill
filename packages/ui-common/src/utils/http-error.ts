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
