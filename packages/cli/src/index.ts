#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  Post2allApiError,
  Post2allClient,
  type AccountSettings,
  type CreatePostInput,
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

type PostCreateOptions = {
  type: "text" | "image" | "video";
  accounts: string;
  content?: string;
  status?: "draft" | "scheduled" | "publish_now";
  scheduledAt?: string;
  mediaIds?: string;
  accountSettings?: string;
  json?: boolean;
};

type PostsOptions = {
  page?: string;
  limit?: string;
  status?: "draft" | "scheduled" | "published" | "partially_failed" | "failed";
  type?: "text" | "image" | "video";
  json?: boolean;
};

type PostUpdateOptions = {
  type?: "text" | "image" | "video";
  accounts?: string;
  content?: string;
  status?: "draft" | "scheduled";
  scheduledAt?: string;
  accountSettings?: string;
  json?: boolean;
};

type PostStatusOptions = {
  status: "draft" | "scheduled";
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

function parseJsonObject(input?: string): AccountSettings | undefined {
  if (!input) {
    return undefined;
  }

  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("account-settings must be a JSON object");
  }

  const entries = Object.entries(parsed);
  const normalized: AccountSettings = {};

  for (const [key, value] of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("account-settings values must be JSON objects");
    }
    normalized[key] = value as Record<string, unknown>;
  }

  return normalized;
}

function handleError(error: unknown): never {
  if (error instanceof Post2allApiError) {
    console.error(
      `API Error (${error.code}, ${error.status}): ${error.message}`,
    );
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
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
  .description("Create a post")
  .requiredOption("--type <type>", "Post type (text, image, video)")
  .requiredOption("--accounts <ids>", "Comma-separated social account IDs")
  .option("--content <text>", "Post content")
  .option("--status <status>", "Status: draft, scheduled, or publish_now")
  .option("--scheduled-at <isoDate>", "ISO date for scheduled posts")
  .option("--media-ids <ids>", "Comma-separated IDs from `media upload`")
  .option(
    "--account-settings <json>",
    "Per-account settings as JSON object keyed by account ID",
  )
  .option("--json", "Output JSON")
  .action(async (options: PostCreateOptions) => {
    try {
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);

      const status =
        options.status === "publish_now" ? "scheduled" : options.status;

      const payload: CreatePostInput = {
        type: options.type,
        socialAccountIds: parseCsv(options.accounts),
        content: options.content,
        status,
        scheduledAt: options.scheduledAt,
        mediaIds: options.mediaIds ? parseCsv(options.mediaIds) : undefined,
        accountSettings: parseJsonObject(options.accountSettings),
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
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
  .option("--content <text>", "Post content")
  .option("--accounts <ids>", "Comma-separated social account IDs")
  .option("--status <status>", "Status: draft or scheduled")
  .option("--scheduled-at <isoDate>", "ISO date for scheduled posts")
  .option(
    "--account-settings <json>",
    "Per-account settings as JSON object keyed by account ID",
  )
  .option("--json", "Output JSON")
  .action(async (postId: string, options: PostUpdateOptions) => {
    try {
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);

      const input: UpdatePostInput = {};

      if (options.type) input.type = options.type;
      if (options.content) input.content = options.content;
      if (options.accounts) input.socialAccountIds = parseCsv(options.accounts);
      if (options.status) input.status = options.status;
      if (options.scheduledAt) input.scheduledAt = options.scheduledAt;
      if (options.accountSettings) {
        input.accountSettings = parseJsonObject(options.accountSettings);
      }

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
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
  .description("Cancel a scheduled post (move back to draft)")
  .argument("<postId>", "Post ID")
  .option("--json", "Output JSON")
  .action(async (postId: string, options: { json?: boolean }) => {
    try {
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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

postCommand
  .command("status")
  .description("Toggle a post between draft and scheduled")
  .argument("<postId>", "Post ID")
  .requiredOption("--status <status>", "Target status: draft or scheduled")
  .option("--json", "Output JSON")
  .action(async (postId: string, options: PostStatusOptions) => {
    try {
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
      const response = await client.updatePost(postId, {
        status: options.status,
      });

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      console.log(`Post ${postId} moved to ${response.post.status}`);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("posts")
  .description("List posts")
  .option("--page <page>", "Page number")
  .option("--limit <limit>", "Items per page")
  .option("--status <status>", "Filter by status")
  .option("--type <type>", "Filter by type")
  .option("--json", "Output JSON")
  .action(async (options: PostsOptions) => {
    try {
      const rootOptions = program.opts<RootOptions>();
      const client = await createClient(rootOptions);
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
