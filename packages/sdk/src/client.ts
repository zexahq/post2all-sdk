import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { z } from "zod";

import { Post2allApiError } from "./errors.js";
import {
  type AccountConnectionResponse,
  accountConnectionResponseSchema,
  type AccountConnectionStart,
  accountConnectionStartSchema,
  type AccountPlatformsResponse,
  accountPlatformsResponseSchema,
  type AccountAnalyticsInput,
  accountAnalyticsInputSchema,
  type AccountAnalyticsPostsInput,
  accountAnalyticsPostsInputSchema,
  type AccountAnalyticsPostsResponse,
  accountAnalyticsPostsResponseSchema,
  type AccountAnalyticsResponse,
  accountAnalyticsResponseSchema,
  type ApiErrorBody,
  type ConnectAccountInput,
  type CreatePostInput,
  createPostResponseSchema,
  type CreatePostResponse,
  type DisconnectAccountResponse,
  disconnectAccountResponseSchema,
  type GetAccountResponse,
  getAccountResponseSchema,
  type GetPostResponse,
  getPostResponseSchema,
  type GetAccountPublishingOptionsResponse,
  getAccountPublishingOptionsResponseSchema,
  type ListAccountsResponse,
  listAccountsResponseSchema,
  type PublishingSchemaResponse,
  publishingSchemaResponseSchema,
  type PublishingOptionsResponse,
  publishingOptionsResponseSchema,
  type ListPostsInput,
  type ListPostsResponse,
  listPostsResponseSchema,
  type PostAnalyticsInput,
  postAnalyticsInputSchema,
  type PostAnalyticsResponse,
  postAnalyticsResponseSchema,
  type UpdatePostInput,
  type UpdatePostResponse,
  updatePostResponseSchema,
  type RetryPostInput,
  type RetryPostResponse,
  retryPostInputSchema,
  retryPostResponseSchema,
  type DeletePostResponse,
  deletePostResponseSchema,
  type DeletePublishedPostResponse,
  deletePublishedPostResponseSchema,
  type CancelPostResponse,
  cancelPostResponseSchema,
  type ConfirmMediaUploadResponse,
  confirmMediaUploadResponseSchema,
  type CreateMediaUploadInput,
  type CreateMediaUploadResponse,
  createMediaUploadResponseSchema,
  createMediaUploadInputSchema,
  createPostInputSchema,
  listPostsInputSchema,
  accountConnectInputSchema,
  accountReconnectInputSchema,
  type Platform,
  platformSchema,
  type ReconnectAccountInput,
  updatePostInputSchema,
} from "./types.js";

const defaultBaseUrl = "https://app.post2all.com/api/v1";

const mediaContentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

function analyticsQueryString(input: {
  startDate?: string;
  endDate?: string;
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortDirection?: string;
  refresh?: boolean;
}): string {
  const query = new URLSearchParams();
  if (input.startDate !== undefined) query.set("startDate", input.startDate);
  if (input.endDate !== undefined) query.set("endDate", input.endDate);
  if (input.cursor !== undefined) query.set("cursor", input.cursor);
  if (input.limit !== undefined) query.set("limit", String(input.limit));
  if (input.sortBy !== undefined) query.set("sortBy", input.sortBy);
  if (input.sortDirection !== undefined)
    query.set("sortDirection", input.sortDirection);
  if (input.refresh !== undefined) query.set("refresh", String(input.refresh));
  const value = query.toString();
  return value ? `?${value}` : "";
}

export type Post2allClientInfo = {
  name: "cli";
  version?: string;
};

export type Post2allClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  clientInfo?: Post2allClientInfo;
};

export class Post2allClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly clientInfo?: Post2allClientInfo;

  public constructor(options: Post2allClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.clientInfo = options.clientInfo;
  }

  public async listAccounts(): Promise<ListAccountsResponse> {
    const response = await this.request("/accounts");
    return this.parseJson(response, listAccountsResponseSchema);
  }

  public async listAccountPlatforms(): Promise<AccountPlatformsResponse> {
    const response = await this.request("/accounts/platforms");
    return this.parseJson(response, accountPlatformsResponseSchema);
  }

  public async getAccount(accountId: string): Promise<GetAccountResponse> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}`,
    );
    return this.parseJson(response, getAccountResponseSchema);
  }

  public async connectAccount(
    platform: Platform,
    input: ConnectAccountInput = {},
  ): Promise<AccountConnectionStart> {
    platform = platformSchema.parse(platform);
    input = accountConnectInputSchema(platform).parse(
      input,
    ) as ConnectAccountInput;
    const response = await this.request(
      `/accounts/connect/${encodeURIComponent(platform)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return this.parseJson(response, accountConnectionStartSchema);
  }

  public async getAccountConnection(
    connectionId: string,
  ): Promise<AccountConnectionResponse> {
    if (!connectionId) {
      throw new Post2allApiError("connectionId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const response = await this.request(
      `/accounts/connections/${encodeURIComponent(connectionId)}`,
    );
    return this.parseJson(response, accountConnectionResponseSchema);
  }

  public async reconnectAccount(
    accountId: string,
    input: ReconnectAccountInput = {},
  ): Promise<AccountConnectionStart> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    input = accountReconnectInputSchema.parse(input);
    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}/reconnect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return this.parseJson(response, accountConnectionStartSchema);
  }

  public async disconnectAccount(
    accountId: string,
  ): Promise<DisconnectAccountResponse> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}`,
      {
        method: "DELETE",
      },
    );
    return this.parseJson(response, disconnectAccountResponseSchema);
  }

  public async getAccountAnalytics(
    accountId: string,
    input: AccountAnalyticsInput = {},
  ): Promise<AccountAnalyticsResponse> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    input = accountAnalyticsInputSchema.parse(input);
    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}/analytics${analyticsQueryString(input)}`,
    );
    return this.parseJson(response, accountAnalyticsResponseSchema);
  }

  public async listAccountAnalyticsPosts(
    accountId: string,
    input: AccountAnalyticsPostsInput = {},
  ): Promise<AccountAnalyticsPostsResponse> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    input = accountAnalyticsPostsInputSchema.parse(input);
    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}/analytics/posts${analyticsQueryString(input)}`,
    );
    return this.parseJson(response, accountAnalyticsPostsResponseSchema);
  }

  public async getPublishingSchema(
    accountIds: string[],
  ): Promise<PublishingSchemaResponse> {
    if (accountIds.length === 0) {
      throw new Post2allApiError("At least one accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const response = await this.request("/publishing-schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds }),
    });
    return this.parseJson(response, publishingSchemaResponseSchema);
  }

  public async getAccountPublishingOptions(
    accountId: string,
  ): Promise<GetAccountPublishingOptionsResponse> {
    if (!accountId) {
      throw new Post2allApiError("accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const response = await this.request(
      `/accounts/${encodeURIComponent(accountId)}/publishing-options`,
    );
    return this.parseJson(response, getAccountPublishingOptionsResponseSchema);
  }

  public async getPublishingOptions(
    accountIds: string[],
  ): Promise<PublishingOptionsResponse> {
    if (accountIds.length === 0) {
      throw new Post2allApiError("At least one accountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const response = await this.request("/publishing-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds }),
    });
    return this.parseJson(response, publishingOptionsResponseSchema);
  }

  public async createPost(input: CreatePostInput): Promise<CreatePostResponse> {
    input = createPostInputSchema.parse(input);

    const response = await this.request("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return this.parseJson(response, createPostResponseSchema);
  }

  public async createMediaUpload(
    input: CreateMediaUploadInput,
  ): Promise<CreateMediaUploadResponse> {
    input = createMediaUploadInputSchema.parse(input);
    const response = await this.request("/media/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return this.parseJson(response, createMediaUploadResponseSchema);
  }

  public async confirmMediaUpload(
    mediaId: string,
  ): Promise<ConfirmMediaUploadResponse> {
    const response = await this.request(
      `/media/uploads/${encodeURIComponent(mediaId)}/confirm`,
      { method: "POST" },
    );
    return this.parseJson(response, confirmMediaUploadResponseSchema);
  }

  public async uploadMedia(path: string): Promise<ConfirmMediaUploadResponse> {
    const contentType = mediaContentTypes[extname(path).toLowerCase()];
    if (!contentType) {
      throw new Post2allApiError(`Unsupported media file: ${path}`, {
        status: 400,
        code: "UNSUPPORTED_MEDIA",
      });
    }
    const file = await stat(path);
    if (!file.isFile()) {
      throw new Post2allApiError(`Media path is not a file: ${path}`, {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const pending = await this.createMediaUpload({
      filename: basename(path),
      contentType,
      fileSize: file.size,
    });
    const response = await this.fetchImplementation(pending.upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: await readFile(path),
    });
    if (!response.ok) {
      throw new Post2allApiError(
        `Media upload failed with status ${response.status}`,
        { status: response.status, code: "MEDIA_UPLOAD_FAILED" },
      );
    }
    return this.confirmMediaUpload(pending.upload.mediaId);
  }

  public async listPosts(
    input: ListPostsInput = {},
  ): Promise<ListPostsResponse> {
    input = listPostsInputSchema.parse(input);
    const query = new URLSearchParams();

    if (input.page !== undefined) {
      query.set("page", String(input.page));
    }

    if (input.limit !== undefined) {
      query.set("limit", String(input.limit));
    }

    if (input.status !== undefined) {
      query.set("status", input.status);
    }

    const queryString = query.toString();
    const path = queryString.length > 0 ? `/posts?${queryString}` : "/posts";

    const response = await this.request(path);
    return this.parseJson(response, listPostsResponseSchema);
  }

  public async getPost(postId: string): Promise<GetPostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const response = await this.request(`/posts/${encodeURIComponent(postId)}`);
    return this.parseJson(response, getPostResponseSchema);
  }

  public async getPostAnalytics(
    postId: string,
    input: PostAnalyticsInput = {},
  ): Promise<PostAnalyticsResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    input = postAnalyticsInputSchema.parse(input);
    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}/analytics${analyticsQueryString(input)}`,
    );
    return this.parseJson(response, postAnalyticsResponseSchema);
  }

  public async updatePost(
    postId: string,
    input: UpdatePostInput,
  ): Promise<UpdatePostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    input = updatePostInputSchema.parse(input);

    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );

    return this.parseJson(response, updatePostResponseSchema);
  }

  public async deletePost(postId: string): Promise<DeletePostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}`,
      { method: "DELETE" },
    );

    return this.parseJson(response, deletePostResponseSchema);
  }

  public async retryPost(
    postId: string,
    input: RetryPostInput = {},
  ): Promise<RetryPostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    input = retryPostInputSchema.parse(input);
    const response = await this.request(
      "/posts/" + encodeURIComponent(postId) + "/retry",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    return this.parseJson(response, retryPostResponseSchema);
  }

  public async deletePublishedPost(
    postId: string,
    postAccountId: string,
  ): Promise<DeletePublishedPostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    if (!postAccountId) {
      throw new Post2allApiError("postAccountId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}/published`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postAccountId }),
      },
    );
    return this.parseJson(response, deletePublishedPostResponseSchema);
  }

  public async cancelPost(postId: string): Promise<CancelPostResponse> {
    if (!postId) {
      throw new Post2allApiError("postId is required", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}/cancel`,
      { method: "POST" },
    );

    return this.parseJson(response, cancelPostResponseSchema);
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "x-api-key": this.apiKey,
        ...(this.clientInfo
          ? { "x-post2all-client": this.clientInfo.name }
          : {}),
        ...(this.clientInfo?.version
          ? { "x-post2all-client-version": this.clientInfo.version }
          : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw await this.createApiError(response);
    }

    return response;
  }

  private async parseJson<T>(
    response: Response,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new Post2allApiError("API returned invalid JSON", {
        status: response.status,
        code: "INVALID_RESPONSE",
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Post2allApiError("API response did not match expected schema", {
        status: response.status,
        code: "INVALID_RESPONSE",
        details: parsed.error.flatten(),
      });
    }

    return parsed.data;
  }

  private async createApiError(response: Response): Promise<Post2allApiError> {
    let payload: ApiErrorBody | undefined;

    try {
      payload = (await response.json()) as ApiErrorBody;
    } catch {
      payload = undefined;
    }

    const code = payload?.error?.code ?? "HTTP_ERROR";
    const message =
      payload?.error?.message ??
      `Request failed with status ${response.status}`;

    return new Post2allApiError(message, {
      status: response.status,
      code,
      details: payload,
    });
  }
}
