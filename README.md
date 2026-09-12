# post2all-sdk

Open-source TypeScript SDK and CLI for the [post2all](https://www.post2all.com) public API.

## Packages

| Package                           | Description                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------- |
| [`@post2all/sdk`](./packages/sdk) | TypeScript SDK — typed client for account connections, publishing, and analytics |
| [`@post2all/cli`](./packages/cli) | CLI tool — connect accounts and manage posts/analytics from terminal             |

## Quick start

### CLI

```bash
pnpm add -g @post2all/cli
post2all config set-key amp_xxx
post2all accounts
```

### SDK

```bash
pnpm add @post2all/sdk
```

```ts
import { Post2allClient } from "@post2all/sdk";

const client = new Post2allClient({
  apiKey: process.env.POST2ALL_API_KEY,
});

const accounts = await client.listAccounts();
const analytics = await client.getAccountAnalytics(accounts.accounts[0].id);
```

The SDK and CLI can also start headless social-account connections. OAuth users authorize directly with the social network and do not need a post2all account or login session. They also expose normalized account analytics, provider-wide post performance (including external posts when supported), and per-target analytics for post2all posts.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
```

## Related

- [Changelog](./CHANGELOG.md) — versioned SDK and CLI changes and deprecations
- [post2all](https://www.post2all.com) — social media scheduling platform
- [API Reference](https://www.post2all.com/docs/api-reference) — full REST API documentation
