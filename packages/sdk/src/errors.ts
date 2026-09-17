export type Post2allResponseMetadata = {
  requestId?: string;
  idempotencyReplayed: boolean;
  retryAfterSeconds?: number;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    resetAt?: Date;
  };
};

export type Post2allApiErrorOptions = {
  status: number;
  code: string;
  details?: unknown;
  metadata?: Post2allResponseMetadata;
};

export class Post2allApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly metadata?: Post2allResponseMetadata;

  public constructor(message: string, options: Post2allApiErrorOptions) {
    super(message);
    this.name = "Post2allApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.metadata = options.metadata;
  }
}
