import assert from "node:assert/strict";
import test from "node:test";

import { Post2allClient } from "../dist/index.js";

function accountListResponse() {
  return Response.json({ accounts: [] });
}

test("CLI client info is sent as observability headers", async () => {
  let headers;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    clientInfo: { name: "cli", version: "0.3.0" },
    fetchImplementation: async (_url, init) => {
      headers = new Headers(init?.headers);
      return accountListResponse();
    },
  });

  await client.listAccounts();

  assert.equal(headers?.get("x-post2all-client"), "cli");
  assert.equal(headers?.get("x-post2all-client-version"), "0.3.0");
});

test("direct SDK usage does not claim to be the CLI", async () => {
  let headers;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (_url, init) => {
      headers = new Headers(init?.headers);
      return accountListResponse();
    },
  });

  await client.listAccounts();

  assert.equal(headers?.get("x-post2all-client"), null);
  assert.equal(headers?.get("x-post2all-client-version"), null);
});

test("account analytics serializes range and refresh query parameters", async () => {
  let requestedUrl;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        status: "live",
        account: {
          id: "account-1",
          platform: "instagram",
          username: "creator",
          displayName: "Creator",
          avatarUrl: null,
          status: "active",
        },
        range: { startDate: "2026-08-01", endDate: "2026-08-31" },
        capabilities: {
          accountOverview: true,
          accountTimeSeries: true,
          postMetrics: true,
          accountPostListing: true,
          accountMetricKeys: ["views"],
          postMetricKeys: ["views"],
          accountMetricDefinitions: [],
          postMetricDefinitions: [],
        },
        metrics: [{ key: "views", value: 1234, sourceMetric: "views" }],
        series: [],
        fetchedAt: "2026-08-31T12:00:00.000Z",
        comparisons: {},
        comparisonRange: { startDate: "2026-07-01", endDate: "2026-07-31" },
      });
    },
  });

  const result = await client.getAccountAnalytics("account-1", {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    refresh: true,
  });

  assert.equal(
    requestedUrl,
    "https://example.test/api/v1/accounts/account-1/analytics?startDate=2026-08-01&endDate=2026-08-31&refresh=true",
  );
  assert.equal(result.metrics[0]?.value, 1234);
});

test("account analytics posts serializes pagination and metric sorting", async () => {
  let requestedUrl;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        status: "live",
        account: {
          id: "account-1",
          platform: "youtube",
          username: "creator",
          displayName: "Creator",
          avatarUrl: null,
          status: "active",
        },
        range: { startDate: "2026-08-01", endDate: "2026-08-31" },
        capabilities: {
          accountOverview: true,
          accountTimeSeries: true,
          postMetrics: true,
          accountPostListing: true,
          accountMetricKeys: ["views"],
          postMetricKeys: ["views"],
          accountMetricDefinitions: [],
          postMetricDefinitions: [],
        },
        posts: [],
        pagination: {
          limit: 25,
          postCount: 0,
          hasMore: false,
          nextCursor: null,
        },
      });
    },
  });

  await client.listAccountAnalyticsPosts("account-1", {
    cursor: "25",
    limit: 25,
    sortBy: "views",
    sortDirection: "desc",
  });

  assert.equal(
    requestedUrl,
    "https://example.test/api/v1/accounts/account-1/analytics/posts?cursor=25&limit=25&sortBy=views&sortDirection=desc",
  );
});

test("post analytics supports an explicit provider refresh", async () => {
  let requestedUrl;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url) => {
      requestedUrl = String(url);
      return Response.json({ postId: "post-1", targets: [] });
    },
  });

  const result = await client.getPostAnalytics("post-1", { refresh: true });

  assert.equal(
    requestedUrl,
    "https://example.test/api/v1/posts/post-1/analytics?refresh=true",
  );
  assert.equal(result.postId, "post-1");
});

test("post retry sends only the optional schedule time", async () => {
  let requestedUrl;
  let requestedInit;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url, init) => {
      requestedUrl = String(url);
      requestedInit = init;
      return Response.json({
        retry: {
          postId: "post-1",
          status: "scheduled",
          failedTargetCount: 1,
        },
      });
    },
  });

  const result = await client.retryPost("post-1", {
    scheduledAt: "2026-08-31T12:00:00.000Z",
  });

  assert.equal(requestedUrl, "https://example.test/api/v1/posts/post-1/retry");
  assert.equal(requestedInit?.method, "POST");
  assert.deepEqual(JSON.parse(requestedInit?.body), {
    scheduledAt: "2026-08-31T12:00:00.000Z",
  });
  assert.equal(result.retry.failedTargetCount, 1);
});
