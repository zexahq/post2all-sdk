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

export const platformSettingsSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown()),
);

export const createPostInputSchema = z
  .object({
    type: postTypeSchema,
    socialAccountIds: z.array(z.string().min(1)).min(1),
    content: z.string().optional(),
    status: z.enum(["draft", "scheduled"]).optional(),
    scheduledAt: z.string().optional(),
    platformSettings: platformSettingsSchema.optional(),
    mediaIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.type === "text" && !value.content) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Required" });
    }
    if (value.type !== "text" && value.mediaIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["mediaIds"],
        message: `At least one media ID is required for ${value.type} posts`,
      });
    }
    if (value.type === "text" && value.mediaIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["mediaIds"],
        message: "Text posts cannot include media IDs",
      });
    }
  });

export const updatePostInputSchema = z.object({
  type: postTypeSchema.optional(),
  content: z.string().optional(),
  socialAccountIds: z.array(z.string().min(1)).min(1).optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
  scheduledAt: z.string().nullable().optional(),
  platformSettings: platformSettingsSchema.optional(),
});

export const listPostsInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  status: postStatusSchema.optional(),
  type: postTypeSchema.optional(),
});

export const createMediaUploadInputSchema = z.object({
  filename: z.string().min(1),
  contentType: z
    .string()
    .regex(/^(image|video)\/[a-zA-Z0-9.+-]+$/, "Must be image/* or video/*"),
  fileSize: z.number().int().positive(),
});

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

export const createMediaUploadResponseSchema = z.object({
  upload: z.object({
    mediaId: z.string(),
    uploadUrl: z.string(),
    objectKey: z.string(),
    publicUrl: z.string(),
    expiresIn: z.number(),
  }),
});

export const confirmMediaUploadResponseSchema = z.object({
  media: z.object({
    id: z.string(),
    type: z.enum(["image", "video"]),
    sizeBytes: z.number(),
    originalFileName: z.string().nullable(),
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
export type CreateMediaUploadResponse = z.infer<
  typeof createMediaUploadResponseSchema
>;
export type ConfirmMediaUploadResponse = z.infer<
  typeof confirmMediaUploadResponseSchema
>;

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export type CreatePostInput = z.input<typeof createPostInputSchema>;
export type CreateMediaUploadInput = z.input<
  typeof createMediaUploadInputSchema
>;
export type UpdatePostInput = z.input<typeof updatePostInputSchema>;
export type ListPostsInput = z.input<typeof listPostsInputSchema>;

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};
