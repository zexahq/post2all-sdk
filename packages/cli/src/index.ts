#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  Post2allApiError,
  Post2allClient,
  postMediaInputSchema,
  postTargetsSchema,
  type ApiErrorBody,
  type CreatePostInput,
  type Delivery,
  type PostTarget,
  type UpdatePostInput,
} from "@post2all/sdk";
import { Command } from "commander";

const defaultBaseUrl =
  process.env.POST2ALL_API_URL ??
  process.env.POST2ALL_BASE_URL ??
  "https://app.post2all.com/api/v1";
const CLI_PACKAGE_NAME = "@post2all/cli";
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_CHECK_TIMEOUT_MS = 750;
const CLI_VERSION = (() => {
  try {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    return "unknown";
  }
})();

type CliConfig = {
  apiKey?: string;
  baseUrl?: string;
};

type CliUpdateCache = {
  checkedAt?: number;
  latestVersion?: string;
  notifiedAt?: number;
  notifiedVersion?: string;
};

type RootOptions = {
  apiKey?: string;
  baseUrl?: string;
};

type DeliveryMode = "draft" | "now" | "scheduled";
type LegacyStatus = "draft" | "scheduled" | "publish_now";

type DeliveryOptions = {
  delivery?: DeliveryMode;
  status?: LegacyStatus;
  scheduledAt?: string;
};

type PostCreateOptions = DeliveryOptions & {
  content?: string;
  targets?: string;
  media?: string;
  mediaIds?: string;
  json?: boolean;
};

type PostsOptions = {
  page?: string;
  limit?: string;
  status?:
    | "draft"
    | "scheduled"
    | "publishing"
    | "published"
    | "completed"
    | "partially_failed"
    | "failed";
  json?: boolean;
};

type PostUpdateOptions = DeliveryOptions & {
  content?: string;
  targets?: string;
  media?: string;
  mediaIds?: string;
  json?: boolean;
};

function resolveConfigPath(): string {
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME environment variable is required");
  }

  return join(home, ".config", "post2all", "config.json");
}

function resolveUpdateCachePath(): string {
  return join(dirname(resolveConfigPath()), "update-check.json");
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const active = parseVersion(current);
  if (!next || !active) return false;

  for (let index = 0; index < 3; index += 1) {
    if (next[index]! > active[index]!) return true;
    if (next[index]! < active[index]!) return false;
  }
  return false;
}

async function loadUpdateCache(): Promise<CliUpdateCache> {
  try {
    return JSON.parse(
      await readFile(resolveUpdateCachePath(), "utf8"),
    ) as CliUpdateCache;
  } catch {
    return {};
  }
}

async function saveUpdateCache(cache: CliUpdateCache): Promise<void> {
  try {
    const path = resolveUpdateCachePath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // Update checks must never affect CLI commands.
  }
}

async function fetchLatestCliVersion(): Promise<string | undefined> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(CLI_PACKAGE_NAME)}/latest`,
      { signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS) },
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : undefined;
  } catch {
    return undefined;
  }
}

async function maybeNotifyCliUpdate(): Promise<void> {
  if (
    CLI_VERSION === "unknown" ||
    !process.stderr.isTTY ||
    process.env.CI ||
    process.env.POST2ALL_DISABLE_UPDATE_CHECK === "1" ||
    process.argv.includes("--json") ||
    process.argv.includes("--help") ||
    process.argv.includes("-h") ||
    process.argv.includes("--version") ||
    process.argv.includes("-V")
  ) {
    return;
  }

  const now = Date.now();
  const cache = await loadUpdateCache();
  let latestVersion = cache.latestVersion;
  let cacheChanged = false;

  if (!cache.checkedAt || now - cache.checkedAt >= UPDATE_CHECK_INTERVAL_MS) {
    latestVersion = (await fetchLatestCliVersion()) ?? latestVersion;
    cache.checkedAt = now;
    cache.latestVersion = latestVersion;
    cacheChanged = true;
  }

  if (
    latestVersion &&
    isNewerVersion(latestVersion, CLI_VERSION) &&
    (cache.notifiedVersion !== latestVersion ||
      !cache.notifiedAt ||
      now - cache.notifiedAt >= UPDATE_CHECK_INTERVAL_MS)
  ) {
    console.error(
      `\nUpdate available: post2all CLI ${CLI_VERSION} → ${latestVersion}\nRun: npm install -g @post2all/cli@latest`,
    );
    cache.notifiedVersion = latestVersion;
    cache.notifiedAt = now;
    cacheChanged = true;
  }

  if (cacheChanged) await saveUpdateCache(cache);
}

async function loadConfig(): Promise<CliConfig> {
  const path = resolveConfigPath();

  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as CliConfig;
  } catch {
    return {};
  }
}

async function saveConfig(config: CliConfig): Promise<void> {
  const path = resolveConfigPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2), "utf8");
}

async function createClient(rootOptions: RootOptions): Promise<Post2allClient> {
  const config = await loadConfig();
  const apiKey =
    rootOptions.apiKey ?? process.env.POST2ALL_API_KEY ?? config.apiKey;

  if (!apiKey) {
    throw new Error(
      "Missing API key. Use --api-key, set POST2ALL_API_KEY, or run `post2all config set-key <key>`.",
    );
  }

  return new Post2allClient({
    apiKey,
    baseUrl:
      rootOptions.baseUrl ??
      process.env.POST2ALL_BASE_URL ??
      process.env.POST2ALL_API_URL ??
      config.baseUrl ??
      defaultBaseUrl,
    clientInfo: {
      name: "cli",
      ...(CLI_VERSION !== "unknown" ? { version: CLI_VERSION } : {}),
    },
  });
}

function printOutput(value: unknown, asJson = false): void {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  console.table(value as Record<string, unknown>[]);
}

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePostMedia(
  input?: string,
): NonNullable<CreatePostInput["media"]> | undefined {
  if (input === undefined) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("media must be valid JSON");
  }
  if (!Array.isArray(value)) {
    throw new Error("media must be a JSON array");
  }

  return value.map((item, index) => {
    const parsed = postMediaInputSchema.safeParse(item);
    if (!parsed.success) {
      throw new Error(
        `Invalid media item ${index + 1}: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  });
}

function parseTargets(input?: string): PostTarget[] | undefined {
  if (input === undefined) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("targets must be valid JSON");
  }

  const parsed = postTargetsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid targets: ${parsed.error.message}`);
  }

  return parsed.data;
}

function resolveDelivery(options: DeliveryOptions): Delivery | undefined {
  if (options.delivery && options.status) {
    throw new Error("Use --delivery or deprecated --status, not both");
  }

  const legacyMode =
    options.status === "publish_now"
      ? "now"
      : options.status === "draft" || options.status === "scheduled"
        ? options.status
        : undefined;
  const mode = options.delivery ?? legacyMode;

  if (!mode) {
    if (options.scheduledAt) {
      throw new Error("--scheduled-at requires --delivery scheduled");
    }
    return undefined;
  }

  if (mode === "scheduled") {
    if (!options.scheduledAt) {
      throw new Error("--scheduled-at is required for scheduled delivery");
    }
    return { mode, scheduledAt: options.scheduledAt };
  }

  if (options.scheduledAt) {
    throw new Error("--scheduled-at can only be used with scheduled delivery");
  }

  return { mode };
}

function printApiIssues(error: Post2allApiError): void {
  const details = error.details as ApiErrorBody | undefined;
  const issues = details?.error?.issues;
  if (!issues?.length) return;

  for (const issue of issues) {
    console.error(`  ${issue.path || "request"}: ${issue.message}`);
  }
}

function handleError(error: unknown): never {
  if (error instanceof Post2allApiError) {
    console.error(
      `API Error (${error.code}, ${error.status}): ${error.message}`,
    );
    printApiIssues(error);
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  console.error("Unknown error");
  process.exit(1);
}

const program = new Command();

program
  .name("post2all")
  .description("post2all CLI")
  .version(CLI_VERSION)
  .option("--api-key <apiKey>", "API key")
  .option("--base-url <baseUrl>", "Override API base URL");

const configCommand = program
  .command("config")
  .description("Manage local CLI configuration");

configCommand
  .command("set-key")
  .description("Store API key in local config")
  .argument("<apiKey>", "post2all API key")
  .action(async (apiKey: string) => {
    try {
      const config = await loadConfig();
      config.apiKey = apiKey;
      await saveConfig(config);
      console.log("API key saved");
    } catch (error) {
      handleError(error);
    }
  });

configCommand
  .command("whoami")
  .description("Validate current API key")
  .option("--json", "Output JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.listAccounts();
      const summary = {
        accounts: response.accounts.length,
        platforms: [
          ...new Set(response.accounts.map((account) => account.platform)),
        ].sort(),
      };

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      console.log(`API key is valid. Connected accounts: ${summary.accounts}`);
      console.log(`Platforms: ${summary.platforms.join(", ") || "none"}`);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("constraints")
  .description("Get current publishing schema for selected connected accounts")
  .argument("<accountIds...>", "One or more social account IDs")
  .option("--json", "Output JSON")
  .action(async (accountIds: string[], options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.getPublishingSchema(accountIds);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput(
        response.accounts.map((entry) => ({
          accountId: entry.accountId,
          platform: entry.platform,
          name: entry.name,
          textLimit: entry.capability.text.maxLength,
          media: entry.capability.media?.description ?? "None",
          discoveries: entry.discoveries.join(", ") || "none",
        })),
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("accounts")
  .description("List connected social accounts")
  .option("--json", "Output JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.listAccounts();

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput(
        response.accounts.map((account) => ({
          id: account.id,
          platform: account.platform,
          username: account.username,
          displayName: account.displayName,
          status: account.status,
          // Capability summary (not a fixed post type — composition is inferred from media)
          mediaSupport: Object.entries(account.supportedPostTypes)
            .filter(([, supported]) => supported)
            .map(([kind]) => kind)
            .join(", "),
        })),
      );
    } catch (error) {
      handleError(error);
    }
  });

const accountCommand = program
  .command("account")
  .description("Inspect a connected account");

accountCommand
  .command("publishing-options")
  .alias("options")
  .description(
    "Get platform capabilities and account-specific publishing choices",
  )
  .argument("<accountIds...>", "One or more social account IDs")
  .option("--json", "Output JSON")
  .action(async (accountIds: string[], options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.getPublishingOptions(accountIds);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput(
        response.accounts.map((account) => ({
          accountId: account.accountId,
          platform: account.platform,
          boards: account.boards?.length ?? 0,
          destinations: account.destinations?.length ?? 0,
          creatorInfo: account.creatorInfo ? "available" : "none",
        })),
      );
    } catch (error) {
      handleError(error);
    }
  });

const postCommand = program
  .command("post")
  .description("Create and inspect posts");

postCommand
  .command("create")
  .description(
    "Create a draft, scheduled post, or immediate publish (composition inferred from media)",
  )
  .option("--content <text>", "Shared/default post content")
  .option(
    "--targets <json>",
    "PostTarget[] JSON with platform, accountId, and settings",
  )
  .option("--delivery <mode>", "Delivery mode: draft, now, or scheduled")
  .option(
    "--scheduled-at <isoDate>",
    "Timezone-aware ISO date for scheduled delivery",
  )
  .option(
    "--media <json>",
    "Post media JSON array with id and optional altText",
  )
  .option(
    "--media-ids <ids>",
    "Deprecated: comma-separated IDs from `media upload`",
  )
  .option(
    "--status <status>",
    "Deprecated alias: draft, scheduled, or publish_now",
  )
  .option("--json", "Output JSON")
  .action(async (options: PostCreateOptions) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const targets = parseTargets(options.targets);
      const delivery = resolveDelivery(options);
      const media = parsePostMedia(options.media);
      if (media !== undefined && options.mediaIds !== undefined) {
        throw new Error("Use --media or --media-ids, not both");
      }

      const payload: CreatePostInput = {
        ...(options.content !== undefined ? { content: options.content } : {}),
        ...(targets !== undefined ? { targets } : {}),
        ...(delivery !== undefined ? { delivery } : {}),
        ...(media !== undefined ? { media } : {}),
        ...(options.mediaIds !== undefined
          ? { mediaIds: parseCsv(options.mediaIds) }
          : {}),
      };

      const response = await client.createPost(payload);
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }
      printOutput([response.post]);
    } catch (error) {
      handleError(error);
    }
  });

const mediaCommand = program
  .command("media")
  .description("Upload media for use in posts");

mediaCommand
  .command("upload")
  .description("Upload one or more local media files")
  .argument("<paths...>", "Image or video file paths")
  .option("--json", "Output JSON")
  .action(async (paths: string[], options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const results = await Promise.all(
        paths.map((path) => client.uploadMedia(path)),
      );
      const output = { media: results.map((result) => result.media) };
      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
        return;
      }
      printOutput(output.media);
    } catch (error) {
      handleError(error);
    }
  });

postCommand
  .command("get")
  .description("Get post details")
  .argument("<postId>", "Post ID")
  .option("--json", "Output JSON")
  .action(async (postId: string, options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.getPost(postId);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput([
        {
          id: response.post.id,
          status: response.post.status,
          targets: response.post.targets.length,
          scheduledAt: response.post.scheduledAt,
          publishedAt: response.post.publishedAt,
          createdAt: response.post.createdAt,
        },
      ]);
    } catch (error) {
      handleError(error);
    }
  });

postCommand
  .command("update")
  .description("Update a draft, scheduled, failed, or partially failed post")
  .argument("<postId>", "Post ID")
  .option("--content <text>", "Shared/default post content")
  .option("--targets <json>", "Replacement PostTarget[] JSON")
  .option("--delivery <mode>", "Delivery mode: draft, now, or scheduled")
  .option(
    "--scheduled-at <isoDate>",
    "Timezone-aware ISO date for scheduled delivery",
  )
  .option(
    "--media <json>",
    "Replacement post media JSON array with id and optional altText",
  )
  .option(
    "--media-ids <ids>",
    "Deprecated: replacement comma-separated media IDs",
  )
  .option(
    "--status <status>",
    "Deprecated alias: draft, scheduled, or publish_now",
  )
  .option("--json", "Output JSON")
  .action(async (postId: string, options: PostUpdateOptions) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const targets = parseTargets(options.targets);
      const delivery = resolveDelivery(options);
      const media = parsePostMedia(options.media);
      if (media !== undefined && options.mediaIds !== undefined) {
        throw new Error("Use --media or --media-ids, not both");
      }
      const input: UpdatePostInput = {
        ...(options.content !== undefined ? { content: options.content } : {}),
        ...(targets !== undefined ? { targets } : {}),
        ...(delivery !== undefined ? { delivery } : {}),
        ...(media !== undefined ? { media } : {}),
        ...(options.mediaIds !== undefined
          ? { mediaIds: parseCsv(options.mediaIds) }
          : {}),
      };

      const response = await client.updatePost(postId, input);
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }
      printOutput([response.post]);
    } catch (error) {
      handleError(error);
    }
  });

postCommand
  .command("delete-published")
  .description(
    "Delete one published social post without deleting the post2all post",
  )
  .argument("<postId>", "Post ID")
  .requiredOption(
    "--post-account-id <id>",
    "Post target ID from `post get <postId> --json`",
  )
  .option("--json", "Output JSON")
  .action(
    async (
      postId: string,
      options: { postAccountId: string; json?: boolean },
    ) => {
      try {
        const client = await createClient(program.opts<RootOptions>());
        const response = await client.deletePublishedPost(
          postId,
          options.postAccountId,
        );

        if (options.json) {
          console.log(JSON.stringify(response, null, 2));
          return;
        }
        printOutput([response]);
      } catch (error) {
        handleError(error);
      }
    },
  );

postCommand
  .command("delete")
  .description("Delete a post from post2all (published social posts stay live)")
  .argument("<postId>", "Post ID")
  .option("--json", "Output JSON")
  .action(async (postId: string, options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.deletePost(postId);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }
      console.log(`Post removed from post2all: ${response.success}`);
    } catch (error) {
      handleError(error);
    }
  });

postCommand
  .command("cancel")
  .description("Cancel a scheduled post and move it back to draft")
  .argument("<postId>", "Post ID")
  .option("--json", "Output JSON")
  .action(async (postId: string, options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.cancelPost(postId);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }
      printOutput([response.post]);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("posts")
  .description("List posts")
  .option("--page <page>", "Page number")
  .option("--limit <limit>", "Items per page")
  .option("--status <status>", "Filter by post status")
  .option("--json", "Output JSON")
  .action(async (options: PostsOptions) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.listPosts({
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
        status: options.status,
      });

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput(
        response.posts.map((post) => ({
          id: post.id,
          status: post.status,
          targets: post.targets.length,
          scheduledAt: post.scheduledAt,
          publishedAt: post.publishedAt,
          createdAt: post.createdAt,
        })),
      );
      console.log(
        `Page ${response.pagination.page}, limit ${response.pagination.limit}, hasMore=${response.pagination.hasMore}`,
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .parseAsync(process.argv)
  .then(() => maybeNotifyCliUpdate())
  .catch(handleError);
