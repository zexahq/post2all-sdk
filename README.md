# post2all-sdk

Open-source TypeScript SDK and CLI for the [post2all](https://www.post2all.com) public API.

## Packages

| Package                           | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| [`@post2all/sdk`](./packages/sdk) | TypeScript SDK — typed client for the post2all REST API |
| [`@post2all/cli`](./packages/cli) | CLI tool — manage posts and accounts from the terminal  |

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
```

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
```

## Related

- [post2all](https://www.post2all.com) — social media scheduling platform
- [API Reference](https://www.post2all.com/docs/api-reference) — full REST API documentation
