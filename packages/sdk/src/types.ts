import { z } from "zod";

// ─── Shared post contracts ───────────────────────────────────────────────────

export const platformSchema = z.enum([
  "twitter",
  "linkedin",
  "youtube",
  "instagram",
  "facebook",
  "pinterest",
  "threads",
  "dribbble",
  "bluesky",
  "telegram",
  "discord",
  "tiktok",
]);

export const postTypeSchema = z.enum(["text", "image", "video"]);

export const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "partially_failed",
  "failed",
]);

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim().length === 0
    ? undefined
    : value;
}

const optionalTrimmedString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);
const captionSchema = z.string().optional();
const thumbnailTimestampSchema = z.number().finite().min(0).optional();

function getDelimitedTagsLength(tags: readonly string[]): number {
  return tags.reduce(
    (total, tag) => total + tag.length + (/\s/.test(tag) ? 2 : 0),
    Math.max(0, tags.length - 1),
  );
}

export const twitterSettingsSchema = z
  .object({
    caption: captionSchema,
    altText: z.string().max(1_000).optional(),
  })
  .strict();

export const linkedinSettingsSchema = z
  .object({
    caption: captionSchema,
  })
  .strict();

export const youtubeSettingsSchema = z
  .object({
    caption: captionSchema,
    title: z.string().trim().max(100).optional(),
    description: z.string().max(5_000).optional(),
    tags: z
      .array(z.string().trim().min(1))
      .refine(
        (tags) => getDelimitedTagsLength(tags) <= 500,
        "YouTube tags exceed 500 total characters",
      )
      .optional(),
    privacyStatus: z.enum(["public", "private", "unlisted"]).optional(),
    categoryId: optionalTrimmedString,
    thumbnail: optionalUrl,
    thumbnailTimestamp: thumbnailTimestampSchema,
  })
  .strict();

export const instagramSettingsSchema = z
  .object({
    caption: captionSchema,
    altText: z.string().max(1_000).optional(),
    thumbnail: optionalUrl,
    thumbnailTimestamp: thumbnailTimestampSchema,
  })
  .strict();

export const facebookSettingsSchema = z
  .object({
    caption: captionSchema,
  })
  .strict();

export const pinterestSettingsSchema = z
  .object({
    caption: captionSchema,
    title: z.string().trim().max(100).optional(),
    description: z.string().max(800).optional(),
    boardId: optionalTrimmedString,
    altText: z.string().max(500).optional(),
    thumbnail: optionalUrl,
    thumbnailTimestamp: thumbnailTimestampSchema,
  })
  .strict();

export const threadsSettingsSchema = z
  .object({
    caption: captionSchema,
    altText: z.string().max(1_000).optional(),
    topicTag: z.string().trim().max(50).optional(),
  })
  .strict();

export const dribbbleSettingsSchema = z
  .object({
    caption: captionSchema,
    title: z.string().trim().max(255).optional(),
    description: z.string().max(40_000).optional(),
    tags: z.array(z.string().trim().min(1)).max(12).optional(),
    teamId: optionalTrimmedString,
    lowProfile: z.boolean().optional(),
  })
  .strict();

export const blueskySettingsSchema = z
  .object({
    caption: captionSchema,
    altText: z.string().max(10_000).optional(),
  })
  .strict();

export const telegramSettingsSchema = z
  .object({
    caption: captionSchema,
    linkUrl: optionalUrl,
    linkText: z.string().trim().max(64).optional(),
    disableNotification: z.boolean().optional(),
    protectContent: z.boolean().optional(),
  })
  .strict();

export const discordSettingsSchema = z
  .object({
    caption: captionSchema,
    channelId: optionalTrimmedString,
    autoCrosspost: z.boolean().optional(),
  })
  .strict();

export const tiktokPrivacyLevelSchema = z.enum([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
]);

export const tiktokSettingsSchema = z
  .object({
    caption: captionSchema,
    title: z.string().trim().max(90).optional(),
    description: z.string().max(2_000).optional(),
    tiktokPrivacyLevel: tiktokPrivacyLevelSchema.optional(),
    tiktokDisableComment: z.boolean().optional(),
    tiktokDisableDuet: z.boolean().optional(),
    tiktokDisableStitch: z.boolean().optional(),
  })
  .strict();

function targetSchema<
  const P extends Platform,
  S extends z.ZodObject<z.ZodRawShape>,
>(platform: P, settings: S) {
  return z
    .object({
      platform: z.literal(platform),
      accountId: z.string().min(1),
      settings,
    })
    .strict();
}

export const twitterTargetSchema = targetSchema(
  "twitter",
  twitterSettingsSchema,
);
export const linkedinTargetSchema = targetSchema(
  "linkedin",
  linkedinSettingsSchema,
);
export const youtubeTargetSchema = targetSchema(
  "youtube",
  youtubeSettingsSchema,
);
export const instagramTargetSchema = targetSchema(
  "instagram",
  instagramSettingsSchema,
);
export const facebookTargetSchema = targetSchema(
  "facebook",
  facebookSettingsSchema,
);
export const pinterestTargetSchema = targetSchema(
  "pinterest",
  pinterestSettingsSchema,
);
export const threadsTargetSchema = targetSchema(
  "threads",
  threadsSettingsSchema,
);
export const dribbbleTargetSchema = targetSchema(
  "dribbble",
  dribbbleSettingsSchema,
);
export const blueskyTargetSchema = targetSchema(
  "bluesky",
  blueskySettingsSchema,
);
export const telegramTargetSchema = targetSchema(
  "telegram",
  telegramSettingsSchema,
);
export const discordTargetSchema = targetSchema(
  "discord",
  discordSettingsSchema,
);
export const tiktokTargetSchema = targetSchema("tiktok", tiktokSettingsSchema);

export const postTargetSchema = z.discriminatedUnion("platform", [
  twitterTargetSchema,
  linkedinTargetSchema,
  youtubeTargetSchema,
  instagramTargetSchema,
  facebookTargetSchema,
  pinterestTargetSchema,
  threadsTargetSchema,
  dribbbleTargetSchema,
  blueskyTargetSchema,
  telegramTargetSchema,
  discordTargetSchema,
  tiktokTargetSchema,
]);

function addDuplicateTargetIssues(
  targets: PostTarget[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, target] of targets.entries()) {
    if (seen.has(target.accountId)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "accountId"],
        message: `Account ${target.accountId} is included more than once`,
      });
    }
    seen.add(target.accountId);
  }
}

export const postTargetsSchema = z
  .array(postTargetSchema)
  .superRefine(addDuplicateTargetIssues);

export const deliverySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("draft") }).strict(),
  z.object({ mode: z.literal("now") }).strict(),
  z
    .object({
      mode: z.literal("scheduled"),
      scheduledAt: z.string().datetime({ offset: true }),
    })
    .strict(),
]);

function addPostContentIssues(
  value: { type?: PostType; content?: string; mediaIds?: string[] },
  ctx: z.RefinementCtx,
  requireComplete: boolean,
): void {
  if (!value.type || !requireComplete) return;
  const mediaIds = value.mediaIds ?? [];

  if (value.type === "text" && !value.content?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Content is required for text posts",
    });
  }

  if (value.type !== "text" && mediaIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["mediaIds"],
      message: `At least one media ID is required for ${value.type} posts`,
    });
  }

  if (value.type === "text" && mediaIds.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["mediaIds"],
      message: "Text posts cannot include media IDs",
    });
  }
}

export const createPostInputSchema = z
  .object({
    type: postTypeSchema,
    content: z.string().optional(),
    mediaIds: z.array(z.string().min(1)).default([]),
    targets: postTargetsSchema.default([]),
    delivery: deliverySchema.default({ mode: "draft" }),
  })
  .strict()
  .superRefine((value, ctx) => {
    addPostContentIssues(value, ctx, value.delivery.mode !== "draft");
    if (value.delivery.mode !== "draft" && value.targets.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["targets"],
        message:
          "At least one target is required to schedule or publish a post",
      });
    }
  });

export const updatePostInputSchema = z
  .object({
    type: postTypeSchema.optional(),
    content: z.string().optional(),
    mediaIds: z.array(z.string().min(1)).optional(),
    targets: postTargetsSchema.optional(),
    delivery: deliverySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type && value.mediaIds) {
      addPostContentIssues(
        value,
        ctx,
        value.delivery?.mode !== undefined && value.delivery.mode !== "draft",
      );
    }
    if (
      value.delivery?.mode !== undefined &&
      value.delivery.mode !== "draft" &&
      value.targets?.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targets"],
        message:
          "At least one target is required to schedule or publish a post",
      });
    }
  });

export const listPostsInputSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    status: postStatusSchema.optional(),
    type: postTypeSchema.optional(),
  })
  .strict();

// ─── Media upload contracts ──────────────────────────────────────────────────

export const createMediaUploadInputSchema = z
  .object({
    filename: z.string().min(1),
    contentType: z
      .string()
      .regex(/^(image|video)\/[a-zA-Z0-9.+-]+$/, "Must be image/* or video/*"),
    fileSize: z.number().int().positive(),
  })
  .strict();

// ─── Account responses ───────────────────────────────────────────────────────

export const socialAccountSchema = z.object({
  id: z.string(),
  platform: platformSchema,
  platformAccountId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked", "error"]).or(z.string()),
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

const platformFieldCapabilitySchema = z
  .object({
    enabled: z.boolean().optional(),
    required: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    maxCount: z.number().optional(),
    maxTotalLength: z.number().optional(),
    label: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

const platformMediaCapabilitySchema = z
  .object({
    required: z.boolean().optional(),
    minImages: z.number().optional(),
    maxImages: z.number().optional(),
    minVideos: z.number().optional(),
    maxVideos: z.number().optional(),
    maxItems: z.number().optional(),
    allowMixedMedia: z.boolean().optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
    maxImageBytes: z.number().optional(),
    maxVideoBytes: z.number().optional(),
    maxTotalBytes: z.number().optional(),
    requiredImageDimensions: z
      .array(z.object({ width: z.number(), height: z.number() }))
      .optional(),
    description: z.string(),
  })
  .passthrough();

export const platformCapabilitySchema = z
  .object({
    postTypes: z.object({
      text: z.boolean(),
      image: z.boolean(),
      video: z.boolean(),
    }),
    text: z.object({ maxLength: z.number() }),
    media: platformMediaCapabilitySchema.optional(),
    fields: z.record(z.string(), platformFieldCapabilitySchema).optional(),
  })
  .passthrough();

export const platformDestinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["text", "announcement"]),
  parentId: z.string().nullable().optional(),
});

export const tiktokCreatorInfoSchema = z
  .object({
    creator_avatar_url: z.string().optional(),
    creator_username: z.string().optional(),
    creator_nickname: z.string().optional(),
    privacy_level_options: z.array(tiktokPrivacyLevelSchema).optional(),
    comment_disabled: z.boolean().optional(),
    duet_disabled: z.boolean().optional(),
    stitch_disabled: z.boolean().optional(),
    max_video_post_duration_sec: z.number().optional(),
  })
  .passthrough();

export const getAccountPublishingOptionsResponseSchema = z.object({
  accountId: z.string(),
  platform: platformSchema,
  name: z.string(),
  capability: platformCapabilitySchema,
  destinations: z.array(platformDestinationSchema).optional(),
  creatorInfo: tiktokCreatorInfoSchema.optional(),
});

export const publishingConstraintsResponseSchema = z.object({
  guide: z.object({
    workflow: z.string(),
    postType: z.string(),
    accountOptions: z.string(),
  }),
  platforms: z.record(
    platformSchema,
    z.object({
      name: z.string(),
      releaseStatus: z.enum(["public", "coming_soon"]),
      capability: platformCapabilitySchema,
    }),
  ),
  accounts: z.array(
    z.object({
      accountId: z.string(),
      platform: platformSchema,
      textMaxLength: z.number(),
    }),
  ),
});

// ─── Post responses ──────────────────────────────────────────────────────────

export const postMediaSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["image", "video"]).or(z.string()),
    path: z.string(),
    url: z.string().optional(),
    key: z.string().optional(),
    alt: z.string().optional(),
    thumbnail: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    thumbnailTimestamp: z.number().optional(),
    position: z.number().optional(),
    available: z.boolean().optional(),
    mimeType: z.string().optional(),
    sizeBytes: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .passthrough();

export const postResponseTargetSchema = z
  .object({
    id: z.string(),
    accountId: z.string().nullable(),
    platform: platformSchema.or(z.string()),
    settings: z.record(z.string(), z.unknown()),
    platformAccountId: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    displayName: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    disconnected: z.boolean().optional(),
    status: z.string().optional(),
    platformPostId: z.string().nullable().optional(),
    platformPostUrl: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const listPostsItemSchema = z.object({
  id: z.string(),
  type: postTypeSchema.or(z.string()),
  content: z.string().nullable().optional(),
  status: postStatusSchema.or(z.string()),
  scheduledAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  targets: z.array(postResponseTargetSchema),
});

export const listPostsResponseSchema = z.object({
  posts: z.array(listPostsItemSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  }),
});

export const getPostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    type: postTypeSchema.or(z.string()),
    content: z.string().nullable().optional(),
    media: z.array(postMediaSchema),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
    targets: z.array(postResponseTargetSchema),
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
    mediaCount: z.number(),
    targetCount: z.number(),
    targets: z.array(postResponseTargetSchema),
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

export const deletePostResponseSchema = z.object({ success: z.boolean() });

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

// ─── Public types ────────────────────────────────────────────────────────────

export type Platform = z.infer<typeof platformSchema>;
export type PostType = z.infer<typeof postTypeSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type PostTarget = z.infer<typeof postTargetSchema>;
export type PostTargetFor<P extends Platform> = Extract<
  PostTarget,
  { platform: P }
>;

export type TwitterSettings = z.infer<typeof twitterSettingsSchema>;
export type LinkedinSettings = z.infer<typeof linkedinSettingsSchema>;
export type YoutubeSettings = z.infer<typeof youtubeSettingsSchema>;
export type InstagramSettings = z.infer<typeof instagramSettingsSchema>;
export type FacebookSettings = z.infer<typeof facebookSettingsSchema>;
export type PinterestSettings = z.infer<typeof pinterestSettingsSchema>;
export type ThreadsSettings = z.infer<typeof threadsSettingsSchema>;
export type DribbbleSettings = z.infer<typeof dribbbleSettingsSchema>;
export type BlueskySettings = z.infer<typeof blueskySettingsSchema>;
export type TelegramSettings = z.infer<typeof telegramSettingsSchema>;
export type DiscordSettings = z.infer<typeof discordSettingsSchema>;
export type TiktokSettings = z.infer<typeof tiktokSettingsSchema>;

export type PlatformSettingsByPlatform = {
  twitter: TwitterSettings;
  linkedin: LinkedinSettings;
  youtube: YoutubeSettings;
  instagram: InstagramSettings;
  facebook: FacebookSettings;
  pinterest: PinterestSettings;
  threads: ThreadsSettings;
  dribbble: DribbbleSettings;
  bluesky: BlueskySettings;
  telegram: TelegramSettings;
  discord: DiscordSettings;
  tiktok: TiktokSettings;
};

export type SocialAccount = z.infer<typeof socialAccountSchema>;
export type PlatformCapability = z.infer<typeof platformCapabilitySchema>;
export type PlatformDestination = z.infer<typeof platformDestinationSchema>;
export type TikTokCreatorInfo = z.infer<typeof tiktokCreatorInfoSchema>;
export type GetAccountPublishingOptionsResponse = z.infer<
  typeof getAccountPublishingOptionsResponseSchema
>;
export type PublishingConstraintsResponse = z.infer<
  typeof publishingConstraintsResponseSchema
>;
export type PostResponseTarget = z.infer<typeof postResponseTargetSchema>;
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

export type CreatePostInput = z.input<typeof createPostInputSchema>;
export type UpdatePostInput = z.input<typeof updatePostInputSchema>;
export type ListPostsInput = z.input<typeof listPostsInputSchema>;
export type CreateMediaUploadInput = z.input<
  typeof createMediaUploadInputSchema
>;

export type ApiValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    issues?: ApiValidationIssue[];
  };
};
