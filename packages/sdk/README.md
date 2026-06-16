# @post2all/sdk

TypeScript SDK for post2all public API.

## Install

```bash
npm install @post2all/sdk
```

## Usage

```ts
import { Post2allClient } from "@post2all/sdk";

const client = new Post2allClient({
  apiKey: process.env.POST2ALL_API_KEY!,
});

const accounts = await client.listAccounts();

await client.createPost({
  type: "text",
  socialAccountIds: ["acc_twitter", "acc_threads"],
  content: "Long main caption for platforms with more room",
  status: "scheduled",
  scheduledAt: "2026-03-10T09:00:00+05:30",
  platformSettings: {
    threads: {
      caption: "Short Threads version",
    },
  },
});
```

## API

- `listAccounts()`
- `createPost(input)`
- `listPosts(input?)`
- `getPost(postId)`
- `updatePost(postId, input)`
- `deletePost(postId)`
- `cancelPost(postId)`

## Errors

SDK throws `Post2allApiError` for API failures and schema validation mismatches.
