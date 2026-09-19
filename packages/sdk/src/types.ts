import { z } from "zod";
import { PUBLIC_PUBLISHING_CONTRACT } from "./generated/publishing-contract.js";

// ─── Shared post contracts ───────────────────────────────────────────────────

const platformIds = Object.keys(PUBLIC_PUBLISHING_CONTRACT.platforms) as [
  keyof typeof PUBLIC_PUBLISHING_CONTRACT.platforms,
  ...(keyof typeof PUBLIC_PUBLISHING_CONTRACT.platforms)[],
];
export const platformSchema = z.enum(platformIds);
export type Platform = z.infer<typeof platformSchema>;

type ContractFieldValue<C> = C extends { type: "boolean" }
  ? boolean
  : C extends { type: "number" }
    ? number
    : C extends { type: "tags" }
      ? string[]
      : C extends {
            type: "enum";
            options: readonly { value: infer V extends string }[];
          }
        ? V
        : string;

export type PlatformSettingsByPlatform = {
  [P in Platform]: Partial<{
    [K in keyof (typeof PUBLIC_PUBLISHING_CONTRACT.platforms)[P]["capability"]["fields"]]: ContractFieldValue<
      (typeof PUBLIC_PUBLISHING_CONTRACT.platforms)[P]["capability"]["fields"][K]
    >;
  }>;
};

/** Derived composition stored on posts for display/filter; not required on create/update. */
export const postTypeSchema = z.enum(["text", "image", "video", "mixed"]);

export const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "completed",
  "partially_failed",
  "failed",
]);

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim().length === 0
    ? undefined
    : value;
}

function getDelimitedTagsLength(tags: readonly string[]): number {
  return tags.reduce(
    (total, tag) => total + tag.length + (/\s/.test(tag) ? 2 : 0),
    Math.max(0, tags.length - 1),
  );
}

type GeneratedField = {
  type?: string;
  trim?: boolean;
  emptyAsUndefined?: boolean;
  minLength?: number;
  maxLength?: number;
  maxCount?: number;
  maxTotalLength?: number;
  minValue?: number;
  options?: readonly { value: string; label: string }[];
};

function buildGeneratedFieldSchema(
  name: string,
  config: GeneratedField,
): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (config.type) {
    case "boolean":
      schema = z.boolean();
      break;
    case "number": {
      let numberSchema = z.number().finite();
      if (config.minValue !== undefined)
        numberSchema = numberSchema.min(config.minValue);
      schema = numberSchema;
      break;
    }
    case "tags": {
      let tagsSchema = z.array(z.string().trim().min(1));
      if (config.maxCount !== undefined)
        tagsSchema = tagsSchema.max(config.maxCount);
      schema = config.maxTotalLength
        ? tagsSchema.refine(
            (tags) => getDelimitedTagsLength(tags) <= config.maxTotalLength!,
            `${name} exceed ${config.maxTotalLength} total characters`,
          )
        : tagsSchema;
      break;
    }
    case "url":
      schema = z.string().url();
      break;
    case "enum": {
      const values = config.options?.map((option) => option.value) ?? [];
      schema = values.length
        ? z.enum(values as [string, ...string[]])
        : z.string().trim().min(1);
      break;
    }
    default: {
      let stringSchema = z.string();
      if (config.trim) stringSchema = stringSchema.trim();
      if (config.minLength !== undefined)
        stringSchema = stringSchema.min(config.minLength);
      if (config.maxLength !== undefined)
        stringSchema = stringSchema.max(config.maxLength);
      schema = stringSchema;
    }
  }
  const optional = schema.optional();
  return config.emptyAsUndefined
    ? z.preprocess(emptyStringToUndefined, optional)
    : optional;
}

function buildGeneratedSettingsSchema<P extends Platform>(
  platform: P,
): z.ZodType<PlatformSettingsByPlatform[P]> {
  const fields =
    PUBLIC_PUBLISHING_CONTRACT.platforms[platform].capability.fields;
  return z
    .object(
      Object.fromEntries(
        Object.entries(fields).map(([name, config]) => [
          name,
          buildGeneratedFieldSchema(name, config),
        ]),
      ),
    )
    .strict() as z.ZodType<PlatformSettingsByPlatform[P]>;
}

export const twitterSettingsSchema = buildGeneratedSettingsSchema("twitter");

export const linkedinSettingsSchema = buildGeneratedSettingsSchema("linkedin");

export const youtubeSettingsSchema = buildGeneratedSettingsSchema("youtube");

export const instagramSettingsSchema =
  buildGeneratedSettingsSchema("instagram");

export const facebookSettingsSchema = buildGeneratedSettingsSchema("facebook");

export const pinterestSettingsSchema =
  buildGeneratedSettingsSchema("pinterest");

export const threadsSettingsSchema = buildGeneratedSettingsSchema("threads");

export const dribbbleSettingsSchema = buildGeneratedSettingsSchema("dribbble");

export const blueskySettingsSchema = buildGeneratedSettingsSchema("bluesky");

export const telegramSettingsSchema = buildGeneratedSettingsSchema("telegram");

export const discordSettingsSchema = buildGeneratedSettingsSchema("discord");

export const wircleSettingsSchema = buildGeneratedSettingsSchema("wircle");

const tiktokPrivacyValues =
  PUBLIC_PUBLISHING_CONTRACT.platforms.tiktok.capability.fields.tiktokPrivacyLevel.options.map(
    (option) => option.value,
  );
export const tiktokPrivacyLevelSchema = z.enum(
  tiktokPrivacyValues as [
    (typeof tiktokPrivacyValues)[number],
    ...(typeof tiktokPrivacyValues)[number][],
  ],
);

export const tiktokSettingsSchema = buildGeneratedSettingsSchema("tiktok");

export type PostTarget = {
  [P in Platform]: {
    platform: P;
    accountId: string;
    settings: PlatformSettingsByPlatform[P];
  };
}[Platform];
export type PostTargetFor<P extends Platform> = Extract<
  PostTarget,
  { platform: P }
>;

function targetSchema<const P extends Platform>(platform: P) {
  return z
    .object({
      platform: z.literal(platform),
      accountId: z.string().min(1),
      settings: buildGeneratedSettingsSchema(platform),
    })
    .strict();
}

const targetSchemas = platformIds.map((platform) => targetSchema(platform));
export const postTargetSchema = z.discriminatedUnion(
  "platform",
  targetSchemas as unknown as [
    (typeof targetSchemas)[number],
    (typeof targetSchemas)[number],
    ...(typeof targetSchemas)[number][],
  ],
) as z.ZodType<PostTarget>;

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

const publicHttpsMediaUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Media URLs must use HTTPS",
  });

export const postMediaInputSchema = z.union([
  z
    .object({
      id: z.string().min(1),
      url: z.never().optional(),
      altText: z.string().optional(),
    })
    .strict(),
  z
    .object({
      id: z.never().optional(),
      url: publicHttpsMediaUrlSchema,
      altText: z.string().optional(),
    })
    .strict(),
]);

function addPostContentIssues(
  value: {
    content?: string;
    media?: z.infer<typeof postMediaInputSchema>[];
    mediaIds?: string[];
  },
  ctx: z.RefinementCtx,
  requireComplete: boolean,
): void {
  if (!requireComplete) return;
  const hasMedia =
    (value.media?.length ?? 0) > 0 || (value.mediaIds?.length ?? 0) > 0;
  if (!hasMedia && !value.content?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["content"],
      message: "Content or media is required",
    });
  }
}

export const createPostInputSchema = z
  .object({
    content: z.string().optional(),
    media: z.array(postMediaInputSchema).optional(),
    mediaIds: z.array(z.string().min(1)).optional(),
    targets: postTargetsSchema.default([]),
    delivery: deliverySchema.default({ mode: "draft" }),
  })
  .strict()
  .superRefine((value, ctx) => {
    addPostContentIssues(value, ctx, value.delivery.mode !== "draft");
    if ((value.media?.length ?? 0) > 0 && (value.mediaIds?.length ?? 0) > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Use media or mediaIds, not both",
      });
    }
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
    content: z.string().optional(),
    media: z.array(postMediaInputSchema).optional(),
    mediaIds: z.array(z.string().min(1)).optional(),
    targets: postTargetsSchema.optional(),
    delivery: deliverySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.media !== undefined && value.mediaIds !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Use media or mediaIds, not both",
      });
    }
    if (
      value.media !== undefined ||
      value.mediaIds !== undefined ||
      value.content !== undefined
    ) {
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

export const retryPostInputSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const listPostsInputSchema = z
  .object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    status: postStatusSchema.optional(),
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

export const uploadMediaFromUrlInputSchema = z
  .object({
    url: publicHttpsMediaUrlSchema,
    filename: z.string().min(1).max(255).optional(),
  })
  .strict();

// ─── Account responses ───────────────────────────────────────────────────────

export const socialAccountSchema = z.object({
  id: z.string(),
  profileId: z.string().nullable().optional(),
  platform: platformSchema,
  platformAccountId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked", "error"]).or(z.string()),
  lastError: z.string().nullable().optional(),
  reconnectable: z.boolean().optional(),
  connectionType: z
    .enum(PUBLIC_PUBLISHING_CONTRACT.accounts.connectionTypes)
    .optional(),
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

const publicAccountConnectionContract = PUBLIC_PUBLISHING_CONTRACT.accounts;

export const accountConnectionTypeSchema = z.enum(
  publicAccountConnectionContract.connectionTypes,
);
export const accountConnectionStatusSchema = z.enum(
  publicAccountConnectionContract.connectionStatuses,
);
export const accountConnectionErrorCodeSchema = z.enum(
  publicAccountConnectionContract.errorCodes,
);

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const accountRedirectUrlSchema = z
  .string()
  .max(publicAccountConnectionContract.redirectUrlMaxLength)
  .url()
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Redirect URL is invalid" });
      return;
    }
    if (url.username || url.password) {
      ctx.addIssue({
        code: "custom",
        message: "Redirect URL must not contain credentials",
      });
    }
    if (url.hash) {
      ctx.addIssue({
        code: "custom",
        message: "Redirect URL must not contain a fragment",
      });
    }
    if (url.protocol === "https:") return;
    if (url.protocol === "http:" && loopbackHosts.has(url.hostname)) return;
    ctx.addIssue({
      code: "custom",
      message:
        "Redirect URL must use HTTPS, except HTTP loopback URLs for local development",
    });
  });

export const wircleAccountCredentialsSchema = z
  .object({
    apiKey: z.string().min(1),
    profileHandle: z.string().min(1),
  })
  .strict();

const oauthAccountConnectInputSchema = z
  .object({
    redirectUrl: accountRedirectUrlSchema.optional(),
    handle: z.string().min(1).max(253).optional(),
  })
  .strict();

const telegramAccountConnectInputSchema = z.object({}).strict();
const wircleAccountConnectInputSchema = z
  .object({ credentials: wircleAccountCredentialsSchema })
  .strict();

export function accountConnectInputSchema(platform: Platform) {
  if (platform === "telegram") return telegramAccountConnectInputSchema;
  if (platform === "wircle") return wircleAccountConnectInputSchema;
  return oauthAccountConnectInputSchema;
}

export const accountReconnectInputSchema = z
  .object({
    redirectUrl: accountRedirectUrlSchema.optional(),
    handle: z.string().min(1).max(253).optional(),
    credentials: wircleAccountCredentialsSchema.optional(),
  })
  .strict();

export const accountPlatformSchema = z.object({
  platform: platformSchema,
  name: z.string(),
  authType: z.enum(["oauth", "bot", "api_key"]),
  connectionType: accountConnectionTypeSchema,
  releaseStatus: z.string(),
  canConnect: z.boolean(),
  supportsReconnect: z.boolean(),
  requiresBrowser: z.boolean(),
});

export const accountPlatformsResponseSchema = z.object({
  platforms: z.array(accountPlatformSchema),
  usage: z.object({
    totalConnected: z.number().int().nonnegative(),
    maxConnectedAccounts: z.number().int().nonnegative(),
    remainingSlots: z.number().int().nonnegative(),
    canConnectMore: z.boolean(),
  }),
});

export const accountConnectionStartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("oauth"),
    connectionId: z.string(),
    authorizationUrl: z.string().url(),
    expiresAt: z.string(),
  }),
  z.object({
    type: z.literal("bot_code"),
    connectionId: z.string(),
    code: z.string(),
    botUsername: z.string(),
    expiresAt: z.string(),
  }),
  z.object({
    type: z.literal("api_key"),
    connectionId: z.string(),
    status: z.literal("connected"),
    accountIds: z.array(z.string()).min(1),
  }),
]);

export const accountConnectionResponseSchema = z.object({
  connectionId: z.string(),
  profileId: z.string().nullable().optional(),
  platform: platformSchema,
  type: accountConnectionTypeSchema,
  status: accountConnectionStatusSchema,
  expiresAt: z.string(),
  accountIds: z.array(z.string()),
  error: z
    .object({
      code: accountConnectionErrorCodeSchema,
      message: z.string(),
    })
    .nullable(),
});

export const getAccountResponseSchema = z.object({
  account: socialAccountSchema,
});
export const disconnectAccountResponseSchema = z.object({
  success: z.literal(true),
});

// ─── Profiles ────────────────────────────────────────────────────────────────

export const profileNameSchema = z.string().trim().min(1).max(120);
export const profileExternalIdSchema = z.string().trim().min(1).max(255);
export const profileMetadataSchema = z.record(z.string(), z.unknown());

export const createProfileInputSchema = z
  .object({
    name: profileNameSchema,
    externalId: profileExternalIdSchema.optional(),
    metadata: profileMetadataSchema.optional(),
  })
  .strict();

export const updateProfileInputSchema = z
  .object({
    name: profileNameSchema.optional(),
    externalId: profileExternalIdSchema.nullable().optional(),
    metadata: profileMetadataSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.externalId !== undefined ||
      value.metadata !== undefined,
    { message: "At least one profile field must be provided" },
  );

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  externalId: z.string().nullable(),
  metadata: profileMetadataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const profileResponseSchema = z.object({ profile: profileSchema });
export const profileListResponseSchema = z.object({
  profiles: z.array(profileSchema),
});
export const profileDeleteResponseSchema = z.object({
  success: z.literal(true),
});

// ─── Analytics contracts ────────────────────────────────────────────────────

const publicAnalyticsContract = PUBLIC_PUBLISHING_CONTRACT.analytics;

const analyticsDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

export const analyticsSortBySchema = z.enum(publicAnalyticsContract.sortBy);

export const analyticsSortDirectionSchema = z.enum(
  publicAnalyticsContract.sortDirections,
);

export const accountAnalyticsInputSchema = z
  .object({
    startDate: analyticsDateStringSchema.optional(),
    endDate: analyticsDateStringSchema.optional(),
    refresh: z.boolean().optional(),
  })
  .strict();

export const accountAnalyticsPostsInputSchema = accountAnalyticsInputSchema
  .extend({
    cursor: z.string().min(1).max(2000).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(publicAnalyticsContract.maxPostsPageSize)
      .optional(),
    sortBy: analyticsSortBySchema.optional(),
    sortDirection: analyticsSortDirectionSchema.optional(),
  })
  .strict();

export const postAnalyticsInputSchema = z
  .object({ refresh: z.boolean().optional() })
  .strict();

export const analyticsMetricSchema = z.object({
  key: z.enum(publicAnalyticsContract.metricKeys).or(z.string()),
  value: z.number(),
  sourceMetric: z.string(),
});

export const analyticsMetricDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  group: z.enum(publicAnalyticsContract.metricGroups).or(z.string()),
  format: z.enum(publicAnalyticsContract.metricFormats).or(z.string()),
  account: z.boolean(),
  post: z.boolean(),
  series: z.boolean(),
});

export const analyticsCapabilitiesSchema = z.object({
  accountOverview: z.boolean(),
  accountTimeSeries: z.boolean(),
  postMetrics: z.boolean(),
  accountPostListing: z.boolean(),
  accountMetricKeys: z.array(
    z.enum(publicAnalyticsContract.metricKeys).or(z.string()),
  ),
  postMetricKeys: z.array(
    z.enum(publicAnalyticsContract.metricKeys).or(z.string()),
  ),
  accountMetricDefinitions: z.array(analyticsMetricDefinitionSchema),
  postMetricDefinitions: z.array(analyticsMetricDefinitionSchema),
});

export const analyticsAccountSchema = z.object({
  id: z.string(),
  platform: platformSchema.or(z.string()),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

export const analyticsRangeSchema = z.object({
  startDate: analyticsDateStringSchema,
  endDate: analyticsDateStringSchema,
});

export const analyticsComparisonSchema = z.object({
  previousValue: z.number(),
  delta: z.number(),
  percent: z.number().optional(),
  unit: z.enum(publicAnalyticsContract.comparisonUnits),
});

export const accountAnalyticsResponseSchema = z.object({
  status: z.enum(publicAnalyticsContract.accountStatuses).or(z.string()),
  account: analyticsAccountSchema,
  range: analyticsRangeSchema,
  capabilities: analyticsCapabilitiesSchema,
  metrics: z.array(analyticsMetricSchema),
  series: z.array(
    z.object({
      date: analyticsDateStringSchema,
      metrics: z.array(analyticsMetricSchema),
    }),
  ),
  fetchedAt: z.string().nullable(),
  comparisons: z.record(z.string(), analyticsComparisonSchema),
  comparisonRange: analyticsRangeSchema.nullable(),
  message: z.string().optional(),
});

export const accountAnalyticsPostSchema = z.object({
  platformPostId: z.string(),
  publishedAt: z.string(),
  content: z.string().nullable(),
  mediaType: z.enum(publicAnalyticsContract.postMediaTypes).nullable(),
  thumbnailUrl: z.string().nullable().optional(),
  platformPostUrl: z.string().nullable().optional(),
  metrics: z.array(analyticsMetricSchema),
  origin: z.enum(["post2all", "external"]),
  postId: z.string().optional(),
  postAccountId: z.string().optional(),
  analyticsAvailable: z.boolean(),
});

export const accountAnalyticsPostsResponseSchema = z.object({
  status: z.enum(publicAnalyticsContract.accountPostStatuses).or(z.string()),
  account: analyticsAccountSchema,
  range: analyticsRangeSchema,
  capabilities: analyticsCapabilitiesSchema,
  posts: z.array(accountAnalyticsPostSchema),
  pagination: z.object({
    limit: z.number(),
    postCount: z.number().nullable(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable().optional(),
  }),
  message: z.string().optional(),
});

export const postAnalyticsTargetSchema = z.object({
  postAccountId: z.string(),
  account: analyticsAccountSchema.nullable(),
  platform: platformSchema.or(z.string()),
  deliveryStatus: z.string(),
  platformPostId: z.string().nullable(),
  platformPostUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  analyticsStatus: z
    .enum(publicAnalyticsContract.postTargetStatuses)
    .or(z.string()),
  analyticsAvailable: z.boolean(),
  capabilities: analyticsCapabilitiesSchema.nullable(),
  metrics: z.array(analyticsMetricSchema),
  message: z.string().optional(),
});

export const postAnalyticsResponseSchema = z.object({
  postId: z.string(),
  targets: z.array(postAnalyticsTargetSchema),
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
    type: z
      .enum(["text", "url", "boolean", "enum", "tags", "number"])
      .optional(),
    valueSource: z
      .enum(["free_text", "static_enum", "account_discovery"])
      .optional(),
    options: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .optional(),
    discoveryKey: z.enum(["destinations", "boards", "creatorInfo"]).optional(),
    defaultValue: z.union([z.string(), z.boolean(), z.number()]).optional(),
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
    altText: z
      .object({
        mediaTypes: z.array(z.enum(["image", "video"])),
        maxLength: z.number(),
      })
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

export const pinterestBoardSchema = z.object({
  id: z.string(),
  name: z.string(),
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
  boards: z.array(pinterestBoardSchema).optional(),
  destinations: z.array(platformDestinationSchema).optional(),
  creatorInfo: tiktokCreatorInfoSchema.optional(),
});

export const publishingOptionsResponseSchema = z.object({
  accounts: z.array(
    z.object({
      accountId: z.string(),
      platform: platformSchema,
      boards: z.array(pinterestBoardSchema).optional(),
      destinations: z.array(platformDestinationSchema).optional(),
      creatorInfo: tiktokCreatorInfoSchema.optional(),
    }),
  ),
});

export const publishingSchemaResponseSchema = z.object({
  guide: z.object({
    workflow: z.string(),
    media: z.string(),
    accountOptions: z.string(),
  }),
  accounts: z.array(
    z.object({
      accountId: z.string(),
      platform: platformSchema,
      name: z.string(),
      capability: platformCapabilitySchema,
      discoveries: z.array(z.enum(["destinations", "boards", "creatorInfo"])),
    }),
  ),
});

export const creditBillingResponseSchema = z.object({
  organizationType: z.literal("credit"),
  currency: z.literal("USD"),
  status: z.enum(["active", "suspended", "disabled"]),
  hasAccess: z.boolean(),
  balanceMicros: z.number().int(),
  meteredThrough: z.string().nullable(),
  connectedAccountCount: z.number().int().nonnegative(),
  marginalMonthlyPriceMicros: z.number().int().nonnegative(),
  projectedMonthlyMicros: z.number().int().nonnegative(),
  projectedDailyMicros: z.number().int().nonnegative(),
  xUsage: z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    spendMicros: z.number().int().nonnegative(),
    spendAlertMicros: z.number().int().positive().nullable(),
    operations: z.object({
      contentCreate: z.object({
        count: z.number().int().nonnegative(),
        spendMicros: z.number().int().nonnegative(),
      }),
      contentCreateWithUrl: z.object({
        count: z.number().int().nonnegative(),
        spendMicros: z.number().int().nonnegative(),
      }),
    }),
  }),
});

export const xApiPricingResponseSchema = z.object({
  currency: z.literal("USD"),
  markupPercent: z.literal(0),
  source: z.url(),
  lastVerified: z.string(),
  operations: z.array(
    z.object({
      operation: z.enum(["content_create", "content_create_with_url"]),
      displayName: z.string(),
      priceMicros: z.number().int().positive(),
    }),
  ),
});

export const publishingLimitsRequestSchema = z
  .object({ accountIds: z.array(z.string().min(1)).min(1).max(50) })
  .strict()
  .refine(
    (value) => new Set(value.accountIds).size === value.accountIds.length,
    {
      path: ["accountIds"],
      message: "accountIds must not contain duplicates",
    },
  );

const publishingLimitWindowSchema = z.object({
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});

export const publishingLimitsResponseSchema = z.object({
  organizationType: z.literal("credit"),
  enforcement: z.literal("defer"),
  snapshotAt: z.string(),
  accounts: z.array(
    z.object({
      accountId: z.string(),
      platform: platformSchema,
      rollingHour: publishingLimitWindowSchema,
      rolling24Hours: publishingLimitWindowSchema,
      availableNow: z.boolean(),
      nextAvailableAt: z.string().nullable(),
    }),
  ),
});

// Credit-organization webhook delivery contracts.
export const WEBHOOK_EVENT_TYPES = [
  "account.connected",
  "account.reconnect_required",
  "account.disconnected",
  "post.created",
  "post.scheduled",
  "post.target.published",
  "post.target.uploaded",
  "post.target.failed",
  "post.target.deferred",
  "post.published",
  "post.completed",
  "post.partially_failed",
  "post.failed",
  "post.cancelled",
  "billing.balance_low",
  "billing.x_spend_80",
  "billing.x_spend_100",
  "billing.suspended",
  "billing.restored",
] as const;

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

export const webhookEventEnvelopeSchema = z.object({
  id: z.string(),
  type: webhookEventTypeSchema.or(z.literal("webhook.test")),
  apiVersion: z.literal("2026-09-01"),
  createdAt: z.string(),
  organizationId: z.string(),
  profileId: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});

// ─── Post responses ──────────────────────────────────────────────────────────

export const postMediaSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["image", "video"]).or(z.string()),
    path: z.string(),
    url: z.string().optional(),
    key: z.string().optional(),
    altText: z.string().optional(),
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

export const publishedDeletionReasonSchema = z.enum([
  "not_published",
  "already_deleted",
  "not_supported",
  "not_available",
  "time_limit_expired",
  "account_disconnected",
]);

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
    status: z
      .enum(["pending", "publishing", "published", "uploaded", "failed"])
      .or(z.string())
      .optional(),
    deletion: z
      .object({
        available: z.boolean(),
        reason: publishedDeletionReasonSchema.nullable(),
      })
      .optional(),
    platformPostId: z.string().nullable().optional(),
    platformPostUrl: z.string().nullable().optional(),
    providerStatus: z.string().nullable().optional(),
    providerFailReason: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const listPostsItemSchema = z.object({
  id: z.string(),
  profileId: z.string().nullable().optional(),
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
    profileId: z.string().nullable().optional(),
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
    profileId: z.string().nullable().optional(),
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
    profileId: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    status: postStatusSchema.or(z.string()),
    scheduledAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
  }),
});

export const retryPostResponseSchema = z.object({
  retry: z.object({
    postId: z.string(),
    status: z.enum(["publishing", "scheduled"]),
    failedTargetCount: z.number().int().nonnegative(),
  }),
});

export const deletePostResponseSchema = z.object({ success: z.boolean() });

export const deletePublishedPostResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(["deleted", "already_deleted"]),
});

export const cancelPostResponseSchema = z.object({
  post: z.object({
    id: z.string(),
    profileId: z.string().nullable().optional(),
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

export const uploadMediaFromUrlResponseSchema = z.object({
  media: z.object({
    id: z.string(),
    source: z.literal("managed"),
    type: z.enum(["image", "video"]),
    sizeBytes: z.number(),
    publicUrl: z.string().url(),
  }),
});

// ─── Public types ────────────────────────────────────────────────────────────

export type PostType = z.infer<typeof postTypeSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type PostMediaInput = z.infer<typeof postMediaInputSchema>;
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
export type WircleSettings = z.infer<typeof wircleSettingsSchema>;

export type SocialAccount = z.infer<typeof socialAccountSchema>;
export type AccountPlatform = z.infer<typeof accountPlatformSchema>;
export type AccountPlatformsResponse = z.infer<
  typeof accountPlatformsResponseSchema
>;
export type AccountConnectionStart = z.infer<
  typeof accountConnectionStartSchema
>;
export type AccountConnectionResponse = z.infer<
  typeof accountConnectionResponseSchema
>;
export type GetAccountResponse = z.infer<typeof getAccountResponseSchema>;
export type DisconnectAccountResponse = z.infer<
  typeof disconnectAccountResponseSchema
>;
export type Profile = z.infer<typeof profileSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfileListResponse = z.infer<typeof profileListResponseSchema>;
export type ProfileDeleteResponse = z.infer<typeof profileDeleteResponseSchema>;
export type AnalyticsMetric = z.infer<typeof analyticsMetricSchema>;
export type AnalyticsMetricDefinition = z.infer<
  typeof analyticsMetricDefinitionSchema
>;
export type AnalyticsCapabilities = z.infer<typeof analyticsCapabilitiesSchema>;
export type AnalyticsAccount = z.infer<typeof analyticsAccountSchema>;
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export type AnalyticsComparison = z.infer<typeof analyticsComparisonSchema>;
export type AccountAnalyticsPost = z.infer<typeof accountAnalyticsPostSchema>;
export type PostAnalyticsTarget = z.infer<typeof postAnalyticsTargetSchema>;
export type AccountAnalyticsResponse = z.infer<
  typeof accountAnalyticsResponseSchema
>;
export type AccountAnalyticsPostsResponse = z.infer<
  typeof accountAnalyticsPostsResponseSchema
>;
export type PostAnalyticsResponse = z.infer<typeof postAnalyticsResponseSchema>;
export type PlatformCapability = z.infer<typeof platformCapabilitySchema>;
export type PlatformDestination = z.infer<typeof platformDestinationSchema>;
export type TikTokCreatorInfo = z.infer<typeof tiktokCreatorInfoSchema>;
export type GetAccountPublishingOptionsResponse = z.infer<
  typeof getAccountPublishingOptionsResponseSchema
>;
export type PublishingOptionsResponse = z.infer<
  typeof publishingOptionsResponseSchema
>;
export type PublishingSchemaResponse = z.infer<
  typeof publishingSchemaResponseSchema
>;
export type CreditBillingResponse = z.infer<typeof creditBillingResponseSchema>;
export type XApiPricingResponse = z.infer<typeof xApiPricingResponseSchema>;
export type PublishingLimitsRequest = z.infer<
  typeof publishingLimitsRequestSchema
>;
export type PublishingLimitsResponse = z.infer<
  typeof publishingLimitsResponseSchema
>;
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;
export type WebhookEventEnvelope = z.infer<typeof webhookEventEnvelopeSchema>;
export type PostResponseTarget = z.infer<typeof postResponseTargetSchema>;
export type ListAccountsResponse = z.infer<typeof listAccountsResponseSchema>;
export type ListPostsResponse = z.infer<typeof listPostsResponseSchema>;
export type GetPostResponse = z.infer<typeof getPostResponseSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type UpdatePostResponse = z.infer<typeof updatePostResponseSchema>;
export type RetryPostResponse = z.infer<typeof retryPostResponseSchema>;
export type DeletePostResponse = z.infer<typeof deletePostResponseSchema>;
export type PublishedDeletionReason = z.infer<
  typeof publishedDeletionReasonSchema
>;
export type DeletePublishedPostResponse = z.infer<
  typeof deletePublishedPostResponseSchema
>;
export type CancelPostResponse = z.infer<typeof cancelPostResponseSchema>;
export type CreateMediaUploadResponse = z.infer<
  typeof createMediaUploadResponseSchema
>;
export type ConfirmMediaUploadResponse = z.infer<
  typeof confirmMediaUploadResponseSchema
>;
export type UploadMediaFromUrlResponse = z.infer<
  typeof uploadMediaFromUrlResponseSchema
>;

export type CreatePostInput = z.input<typeof createPostInputSchema>;
export type ConnectAccountInput = {
  redirectUrl?: string;
  handle?: string;
  credentials?: z.input<typeof wircleAccountCredentialsSchema>;
};
export type ReconnectAccountInput = z.input<typeof accountReconnectInputSchema>;
export type CreateProfileInput = z.input<typeof createProfileInputSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileInputSchema>;
export type UpdatePostInput = z.input<typeof updatePostInputSchema>;
export type RetryPostInput = z.input<typeof retryPostInputSchema>;
export type ListPostsInput = z.input<typeof listPostsInputSchema>;
export type AccountAnalyticsInput = z.input<typeof accountAnalyticsInputSchema>;
export type AccountAnalyticsPostsInput = z.input<
  typeof accountAnalyticsPostsInputSchema
>;
export type PostAnalyticsInput = z.input<typeof postAnalyticsInputSchema>;
export type CreateMediaUploadInput = z.input<
  typeof createMediaUploadInputSchema
>;
export type UploadMediaFromUrlInput = z.input<
  typeof uploadMediaFromUrlInputSchema
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
