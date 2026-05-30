export type Post2allApiErrorOptions = {
  status: number;
  code: string;
  details?: unknown;
};

export class Post2allApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(message: string, options: Post2allApiErrorOptions) {
    super(message);
    this.name = "Post2allApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}
