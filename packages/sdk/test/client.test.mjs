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
