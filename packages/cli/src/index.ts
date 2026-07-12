#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  Post2allApiError,
  Post2allClient,
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
  "https://www.post2all.com/api/v1";

type CliConfig = {
  apiKey?: string;
  baseUrl?: string;
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
  type: "text" | "image" | "video";
  content?: string;
  targets?: string;
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
    | "partially_failed"
    | "failed";
  type?: "text" | "image" | "video";
  json?: boolean;
};

type PostUpdateOptions = DeliveryOptions & {
  type?: "text" | "image" | "video";
  content?: string;
  targets?: string;
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
          postTypes: Object.entries(account.supportedPostTypes)
            .filter(([, supported]) => supported)
            .map(([type]) => type)
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
  .argument("<accountId>", "Social account ID")
  .option("--json", "Output JSON")
  .action(async (accountId: string, options: { json?: boolean }) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.getAccountPublishingOptions(accountId);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      console.log(`${response.name} (${response.platform})`);
      console.log(
        `Post types: ${Object.entries(response.capability.postTypes)
          .filter(([, supported]) => supported)
          .map(([type]) => type)
          .join(", ")}`,
      );
      if (response.destinations?.length) {
        printOutput(response.destinations);
      }
      if (response.creatorInfo) {
        printOutput([response.creatorInfo]);
      }
    } catch (error) {
      handleError(error);
    }
  });

const postCommand = program
  .command("post")
  .description("Create and inspect posts");

postCommand
  .command("create")
  .description("Create a draft, scheduled post, or immediate publish")
  .requiredOption("--type <type>", "Post type (text, image, video)")
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
  .option("--media-ids <ids>", "Comma-separated IDs from `media upload`")
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

      const payload: CreatePostInput = {
        type: options.type,
        ...(options.content !== undefined ? { content: options.content } : {}),
        ...(targets !== undefined ? { targets } : {}),
        ...(delivery !== undefined ? { delivery } : {}),
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
          type: response.post.type,
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
  .description("Update a draft or scheduled post")
  .argument("<postId>", "Post ID")
  .option("--type <type>", "Post type (text, image, video)")
  .option("--content <text>", "Shared/default post content")
  .option("--targets <json>", "Replacement PostTarget[] JSON")
  .option("--delivery <mode>", "Delivery mode: draft, now, or scheduled")
  .option(
    "--scheduled-at <isoDate>",
    "Timezone-aware ISO date for scheduled delivery",
  )
  .option("--media-ids <ids>", "Replacement comma-separated media IDs")
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
      const input: UpdatePostInput = {
        ...(options.type !== undefined ? { type: options.type } : {}),
        ...(options.content !== undefined ? { content: options.content } : {}),
        ...(targets !== undefined ? { targets } : {}),
        ...(delivery !== undefined ? { delivery } : {}),
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
  .command("delete")
  .description("Delete a post")
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
      console.log(`Post deleted: ${response.success}`);
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
  .option("--type <type>", "Filter by post type")
  .option("--json", "Output JSON")
  .action(async (options: PostsOptions) => {
    try {
      const client = await createClient(program.opts<RootOptions>());
      const response = await client.listPosts({
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
        status: options.status,
        type: options.type,
      });

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      printOutput(
        response.posts.map((post) => ({
          id: post.id,
          type: post.type,
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

program.parseAsync(process.argv).catch(handleError);
