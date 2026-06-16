import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { z } from "zod";

import { Post2allApiError } from "./errors.js";
import {
  type ApiErrorBody,
  type CreatePostInput,
  createPostResponseSchema,
  type CreatePostResponse,
  type GetPostResponse,
  getPostResponseSchema,
  type ListAccountsResponse,
  listAccountsResponseSchema,
  type ListPostsInput,
  type ListPostsResponse,
  listPostsResponseSchema,
  type UpdatePostInput,
  type UpdatePostResponse,
  updatePostResponseSchema,
  type DeletePostResponse,
  deletePostResponseSchema,
  type CancelPostResponse,
  cancelPostResponseSchema,
} from "./types.js";

const defaultBaseUrl = "https://www.post2all.com/api/v1";

export type Post2allClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
};

export class Post2allClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  public constructor(options: Post2allClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  public async listAccounts(): Promise<ListAccountsResponse> {
    const response = await this.request("/accounts");
    return this.parseJson(response, listAccountsResponseSchema);
  }

  public async createPost(input: CreatePostInput): Promise<CreatePostResponse> {
    if (input.socialAccountIds.length === 0) {
      throw new Post2allApiError("socialAccountIds must not be empty", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const body = new FormData();
    body.append("type", input.type);
    body.append("socialAccountIds", JSON.stringify(input.socialAccountIds));

    if (input.content) {
      body.append("content", input.content);
    }

    if (input.status) {
      body.append("status", input.status);
    }

    if (input.scheduledAt) {
      body.append("scheduledAt", input.scheduledAt);
    }

    if (input.platformSettings) {
      body.append("platformSettings", JSON.stringify(input.platformSettings));
    }

    if (input.mediaPaths) {
      await Promise.all(
        input.mediaPaths.map(async (mediaPath) => {
          const data = await readFile(mediaPath);
          const filename = basename(mediaPath);
          const blob = new Blob([data]);
          body.append("media", blob, filename);
        }),
      );
    }

    const response = await this.request("/posts", {
      method: "POST",
      body,
    });

    return this.parseJson(response, createPostResponseSchema);
  }

  public async listPosts(
    input: ListPostsInput = {},
  ): Promise<ListPostsResponse> {
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

    if (input.type !== undefined) {
      query.set("type", input.type);
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

    const body: Record<string, unknown> = {};

    if (input.type !== undefined) {
      body.type = input.type;
    }
    if (input.content !== undefined) {
      body.content = input.content;
    }
    if (input.socialAccountIds !== undefined) {
      body.socialAccountIds = input.socialAccountIds;
    }
    if (input.status !== undefined) {
      body.status = input.status;
    }
    if (input.scheduledAt !== undefined) {
      body.scheduledAt = input.scheduledAt;
    }
    if (input.platformSettings !== undefined) {
      body.platformSettings = input.platformSettings;
    }

    const response = await this.request(
      `/posts/${encodeURIComponent(postId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
