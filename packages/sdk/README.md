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
