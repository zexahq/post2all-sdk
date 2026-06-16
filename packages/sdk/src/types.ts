import { z } from "zod";

export const platformSchema = z.enum([
  "twitter",
  "linkedin",
  "youtube",
  "instagram",
  "pinterest",
  "threads",
  "facebook",
]);

export const postTypeSchema = z.enum(["text", "image", "video"]);

export const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "published",
  "partially_failed",
  "failed",
]);

export const socialAccountSchema = z.object({
  id: z.string(),
  platform: platformSchema.or(z.string()),
  platformAccountId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
  supportedPostTypes: z.object({
    text: z.boolean(),
    image: z.boolean(),
    video: z.boolean(),
  }),
  createdAt: z.string(),
});

export const listAccountsResponseSchema = z.object({
  accounts: z.array(socialAccountSchema),
});

export const listPostsAccountSchema = z.object({
  id: z.string().nullable(),
  platform: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable().optional(),
  disconnected: z.boolean().optional(),
  status: z.string(),
  platformPostUrl: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const listPostsItemSchema = z.object({
  id: z.string(),
  type: postTypeSchema.or(z.string()),
  content: z.string().nullable().optional(),
  status: postStatusSchema.or(z.string()),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  accounts: z.array(listPostsAccountSchema).optional(),
});

export const listPostsResponseSchema = z.object({
  posts: z.array(listPostsItemSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  }),
});

export const postMediaSchema = z.object({
  type: z.string(),
  path: z.string(),
});

export const detailedPostAccountSchema = z.object({
  id: z.string().nullable(),
  platform: z.string(),
  platformAccountId: z.string().nullable().optional(),
  username: z.string().nullable(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  disconnected: z.boolean().optional(),
  status: z.string(),
  platformPostId: z.string().nullable().optional(),
  platformPostUrl: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});

export const getPostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    type: postTypeSchema.or(z.string()),
    content: z.string().nullable().optional(),
    media: z.array(postMediaSchema).optional(),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
    accounts: z.array(detailedPostAccountSchema).optional(),
  }),
});

export const createPostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    type: postTypeSchema.or(z.string()),
    content: z.string().nullable().optional(),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    createdAt: z.string(),
    mediaCount: z.number().optional(),
    accountCount: z.number().optional(),
  }),
});

export const updatePostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    type: postTypeSchema.or(z.string()),
    content: z.string().nullable().optional(),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
  }),
});

export const deletePostResponseSchema = z.object({
  success: z.boolean(),
});

export const cancelPostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    type: postTypeSchema.or(z.string()),
    content: z.string().nullable().optional(),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
  }),
});

export type Platform = z.infer<typeof platformSchema>;
export type PostType = z.infer<typeof postTypeSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;

export type SocialAccount = z.infer<typeof socialAccountSchema>;
export type ListAccountsResponse = z.infer<typeof listAccountsResponseSchema>;
export type ListPostsResponse = z.infer<typeof listPostsResponseSchema>;
export type GetPostResponse = z.infer<typeof getPostResponseSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type UpdatePostResponse = z.infer<typeof updatePostResponseSchema>;
export type DeletePostResponse = z.infer<typeof deletePostResponseSchema>;
export type CancelPostResponse = z.infer<typeof cancelPostResponseSchema>;

export type PlatformSettings = Record<string, Record<string, unknown>>;

export type CreatePostInput = {
  type: PostType;
  socialAccountIds: string[];
  content?: string;
  status?: "draft" | "scheduled";
  scheduledAt?: string;
  platformSettings?: PlatformSettings;
  mediaPaths?: string[];
};

export type UpdatePostInput = {
  type?: PostType;
  content?: string;
  socialAccountIds?: string[];
  status?: "draft" | "scheduled";
  scheduledAt?: string;
  platformSettings?: PlatformSettings;
};

export type ListPostsInput = {
  page?: number;
  limit?: number;
  status?: PostStatus;
  type?: PostType;
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};
