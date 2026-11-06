import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cwd = new URL("..", import.meta.url);

const automation = {
  id: "automation-1",
  platform: "instagram",
  status: "on",
  enabled: true,
  pausedReason: null,
  source: "api",
  account: {
    id: "account-1",
    username: "creator",
    displayName: null,
    avatarUrl: null,
    status: "active",
  },
  post: {
    platformPostId: "17890000000000002",
    url: "https://www.instagram.com/p/OLDER/",
    origin: "instagram",
    publishedAt: null,
    caption: null,
    mediaType: "image",
    thumbnailUrl: null,
    postId: null,
    postAccountId: null,
  },
  settings: {
    instagramCommentHookMatchMode: "keywords",
    instagramCommentHookKeywords: ["guide", "link"],
    instagramCommentHookExcludeKeywords: ["spam"],
    instagramCommentHookMatchType: "contains",
    instagramCommentHookReplyMessage: "Here you go",
    instagramCommentHookDmEnabled: true,
    instagramCommentHookPublicReplyEnabled: true,
    instagramCommentHookPublicReplyMessage: "Check your DMs",
  },
  stats: { sent7d: 0, failed7d: 0, skipped7d: 0, lastDeliveryAt: null },
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
};

async function withStubApi(run) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    requests.push({
      method: req.method,
      url,
      body: body ? JSON.parse(body) : undefined,
    });
    res.setHeader("content-type", "application/json");
    if (url.pathname.endsWith("/analytics/posts")) {
      // The first 90-day window only has a newer post; the link is in the second window.
      const older =
        url.searchParams.get("endDate") < new Date().toISOString().slice(0, 10);
      const page =
        older && !url.searchParams.get("cursor")
          ? "first"
          : older
            ? "second"
            : "recent";
      const post = (id, link) => ({
        platformPostId: id,
        publishedAt: "2026-06-01T00:00:00.000Z",
        content: null,
        mediaType: "image",
        platformPostUrl: link,
        metrics: [],
        origin: "external",
        analyticsAvailable: true,
      });
      res.end(
        JSON.stringify({
          status: "available",
          account: {
            id: "account-1",
            platform: "instagram",
            username: "creator",
            displayName: null,
            avatarUrl: null,
            status: "active",
          },
          range: {
            startDate: url.searchParams.get("startDate"),
            endDate: url.searchParams.get("endDate"),
          },
          capabilities: {
            accountOverview: true,
            accountTimeSeries: true,
            postMetrics: true,
            accountPostListing: true,
            accountMetricKeys: [],
            postMetricKeys: [],
            accountMetricDefinitions: [],
            postMetricDefinitions: [],
          },
          posts:
            page === "recent"
              ? [
                  post(
                    "17890000000000001",
                    "https://www.instagram.com/p/NEWER/",
                  ),
                ]
              : page === "first"
                ? []
                : [
                    post(
                      "17890000000000002",
                      "https://www.instagram.com/p/OLDER/",
                    ),
                  ],
          pagination: {
            limit: 50,
            postCount: null,
            hasMore: page === "first",
            nextCursor: page === "first" ? "c2" : null,
          },
        }),
      );
      return;
    }
    if (req.method === "POST") {
      res.statusCode = 201;
      res.end(JSON.stringify({ automation, warnings: [], created: true }));
      return;
    }
    res.end(
      JSON.stringify({
        automation: { ...automation, enabled: false, status: "paused" },
        warnings: [],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}/api/v1`, requests);
  } finally {
    server.close();
  }
}

async function cli(baseUrl, args) {
  const home = await mkdtemp(join(tmpdir(), "post2all-cli-"));
  return execFileAsync(
    process.execPath,
    ["dist/index.js", "--base-url", baseUrl, ...args],
    {
      cwd,
      env: { ...process.env, HOME: home, POST2ALL_API_KEY: "amp_test" },
    },
  );
}

test("automation help exposes the comment automation commands", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["dist/index.js", "automation", "--help"],
    { cwd },
  );
  for (const command of [
    "list",
    "get",
    "create",
    "update",
    "delete",
    "deliveries",
  ]) {
    assert.match(stdout, new RegExp(`\\b${command}\\b`));
  }
  const { stdout: createHelp } = await execFileAsync(
    process.execPath,
    ["dist/index.js", "automation", "create", "--help"],
    { cwd },
  );
  for (const flag of [
    "--post-id",
    "--post-url",
    "--keyword",
    "--match-mode",
    "--match-type",
    "--exclude",
    "--dm",
    "--no-dm",
    "--public-reply",
  ]) {
    assert.match(createHelp, new RegExp(flag));
  }
});

test("automation create resolves --post-url and maps flags to instagramCommentHook settings", async () => {
  await withStubApi(async (baseUrl, requests) => {
    await cli(baseUrl, [
      "automation",
      "create",
      "--account",
      "account-1",
      "--post-url",
      "https://instagram.com/p/OLDER",
      "--keyword",
      "guide",
      "--keyword",
      "link",
      "--match-mode",
      "keywords",
      "--match-type",
      "contains",
      "--exclude",
      "spam",
      "--dm",
      "Here you go",
      "--public-reply",
      "Check your DMs",
      "--json",
    ]);
    const lookups = requests.filter((request) =>
      request.url.pathname.endsWith("/analytics/posts"),
    );
    assert.equal(
      lookups.length,
      3,
      "recent window, then two pages of the older window",
    );
    const create = requests.find((request) => request.method === "POST");
    assert.deepEqual(create.body, {
      accountId: "account-1",
      platformPostId: "17890000000000002",
      settings: {
        instagramCommentHookKeywords: ["guide", "link"],
        instagramCommentHookExcludeKeywords: ["spam"],
        instagramCommentHookMatchMode: "keywords",
        instagramCommentHookMatchType: "contains",
        instagramCommentHookReplyMessage: "Here you go",
        instagramCommentHookDmEnabled: true,
        instagramCommentHookPublicReplyMessage: "Check your DMs",
        instagramCommentHookPublicReplyEnabled: true,
      },
    });
  });
});

test("automation update sends only the changed fields", async () => {
  await withStubApi(async (baseUrl, requests) => {
    await cli(baseUrl, [
      "automation",
      "update",
      "automation-1",
      "--disable",
      "--no-dm",
      "--json",
    ]);
    const update = requests.find((request) => request.method === "PATCH");
    assert.equal(
      update.url.pathname,
      "/api/v1/comment-automations/automation-1",
    );
    assert.deepEqual(update.body, {
      settings: { instagramCommentHookDmEnabled: false },
      enabled: false,
    });
  });
});
