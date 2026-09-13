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

test("forProfile scopes account and post requests with x-profile-id", async () => {
  const calls = [];
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      return accountListResponse();
    },
  }).forProfile("profile-1");

  await client.listAccounts();

  assert.equal(calls[0]?.headers.get("x-profile-id"), "profile-1");
  assert.equal(calls[0]?.headers.get("x-post2all-profile-id"), null);
});

test("profile lifecycle methods use the public profile endpoints without profile scoping", async () => {
  const calls = [];
  const profile = {
    id: "profile-1",
    name: "Customer One",
    externalId: "customer-1",
    metadata: {},
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  };
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url, init) => {
      const path = new URL(String(url)).pathname;
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (path.endsWith("/profiles") && (init?.method ?? "GET") === "GET") {
        return Response.json({ profiles: [profile] });
      }
      if (path.endsWith("/profiles") && init?.method === "POST") {
        return Response.json({ profile });
      }
      if (path.endsWith("/profiles/profile-1") && init?.method === "PATCH") {
        return Response.json({ profile: { ...profile, name: "Renamed" } });
      }
      if (path.endsWith("/profiles/profile-1") && init?.method === "DELETE") {
        return Response.json({ success: true });
      }
      return Response.json({ profile });
    },
  }).forProfile("profile-1");

  const listed = await client.listProfiles();
  await client.createProfile({
    name: "Customer One",
    externalId: "customer-1",
  });
  await client.getProfile("profile-1");
  const updated = await client.updateProfile("profile-1", { name: "Renamed" });
  const deleted = await client.deleteProfile("profile-1");

  assert.equal(listed.profiles[0]?.id, "profile-1");
  assert.equal(updated.profile.name, "Renamed");
  assert.equal(deleted.success, true);
  assert.equal(
    calls.every((call) => call.headers.get("x-profile-id") === null),
    true,
  );
});

test("setAccountProfile sends nullable profile assignment", async () => {
  let requestedInit;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (_url, init) => {
      requestedInit = init;
      return Response.json({
        account: {
          id: "account-1",
          profileId: null,
          platform: "instagram",
          platformAccountId: "ig-1",
          username: "creator",
          displayName: "Creator",
          avatarUrl: null,
          status: "active",
          lastError: null,
          reconnectable: true,
          connectionType: "oauth",
          supportedPostTypes: { text: true, image: true, video: true },
          createdAt: "2026-09-12T12:00:00.000Z",
        },
      });
    },
  });

  const result = await client.setAccountProfile("account-1", null);
  assert.equal(requestedInit?.method, "PATCH");
  assert.deepEqual(JSON.parse(requestedInit?.body), { profileId: null });
  assert.equal(result.account.profileId, null);
});

test("setAccountProfile remains an organization-level management action", async () => {
  let headers;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (_url, init) => {
      headers = new Headers(init?.headers);
      return Response.json({
        account: {
          id: "account-1",
          profileId: "profile-2",
          platform: "instagram",
          platformAccountId: "ig-1",
          username: "creator",
          displayName: "Creator",
          avatarUrl: null,
          status: "active",
          lastError: null,
          reconnectable: true,
          connectionType: "oauth",
          supportedPostTypes: { text: true, image: true, video: true },
          createdAt: "2026-09-12T12:00:00.000Z",
        },
      });
    },
  }).forProfile("profile-1");

  await client.setAccountProfile("account-1", "profile-2");
  assert.equal(headers?.get("x-profile-id"), null);
});

test("connectAccount starts a headless OAuth connection with caller redirect", async () => {
  let requestedUrl;
  let requestedInit;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url, init) => {
      requestedUrl = String(url);
      requestedInit = init;
      return Response.json({
        type: "oauth",
        connectionId: "conn-1",
        authorizationUrl: "https://instagram.com/oauth/authorize?state=conn-1",
        expiresAt: "2026-09-12T13:15:00.000Z",
      });
    },
  });

  const result = await client.connectAccount("instagram", {
    redirectUrl: "https://client.example/social/callback",
  });

  assert.equal(
    requestedUrl,
    "https://example.test/api/v1/accounts/connect/instagram",
  );
  assert.equal(requestedInit?.method, "POST");
  assert.deepEqual(JSON.parse(requestedInit?.body), {
    redirectUrl: "https://client.example/social/callback",
  });
  assert.equal(result.type, "oauth");
  assert.equal(result.connectionId, "conn-1");
});

test("connectAccount validates Wircle credentials before making a request", async () => {
  let requests = 0;
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async () => {
      requests += 1;
      return Response.json({});
    },
  });

  await assert.rejects(() => client.connectAccount("wircle", {}));
  assert.equal(requests, 0);
});

test("account lifecycle methods use the public account endpoints", async () => {
  const calls = [];
  const client = new Post2allClient({
    apiKey: "amp_test",
    baseUrl: "https://example.test/api/v1",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      const path = new URL(String(url)).pathname;

      if (path.endsWith("/accounts/platforms")) {
        return Response.json({
          platforms: [],
          usage: {
            totalConnected: 0,
            maxConnectedAccounts: 10,
            remainingSlots: 10,
            canConnectMore: true,
          },
        });
      }
      if (path.endsWith("/accounts/connections/conn-1")) {
        return Response.json({
          connectionId: "conn-1",
          platform: "instagram",
          type: "oauth",
          status: "connected",
          expiresAt: "2026-09-12T14:00:00.000Z",
          accountIds: ["account-1"],
          error: null,
        });
      }
      if (path.endsWith("/accounts/account-1/reconnect")) {
        return Response.json({
          type: "oauth",
          connectionId: "conn-2",
          authorizationUrl:
            "https://instagram.com/oauth/authorize?state=conn-2",
          expiresAt: "2026-09-12T14:15:00.000Z",
        });
      }
      if (path.endsWith("/accounts/account-1") && init?.method === "DELETE") {
        return Response.json({ success: true });
      }
      return Response.json({
        account: {
          id: "account-1",
          platform: "instagram",
          platformAccountId: "ig-1",
          username: "creator",
          displayName: "Creator",
          avatarUrl: null,
          status: "active",
          lastError: null,
          reconnectable: true,
          connectionType: "oauth",
          supportedPostTypes: { text: true, image: true, video: true },
          createdAt: "2026-09-12T12:00:00.000Z",
        },
      });
    },
  });

  await client.listAccountPlatforms();
  const account = await client.getAccount("account-1");
  const connection = await client.getAccountConnection("conn-1");
  await client.reconnectAccount("account-1", {
    redirectUrl: "https://client.example/callback",
  });
  const disconnected = await client.disconnectAccount("account-1");

  assert.equal(account.account.reconnectable, true);
  assert.equal(connection.status, "connected");
  assert.equal(disconnected.success, true);
  assert.deepEqual(calls, [
    { url: "https://example.test/api/v1/accounts/platforms", method: "GET" },
    { url: "https://example.test/api/v1/accounts/account-1", method: "GET" },
    {
      url: "https://example.test/api/v1/accounts/connections/conn-1",
      method: "GET",
    },
    {
      url: "https://example.test/api/v1/accounts/account-1/reconnect",
      method: "POST",
    },
    {
      url: "https://example.test/api/v1/accounts/account-1",
      method: "DELETE",
    },
  ]);
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
