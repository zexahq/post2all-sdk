# @post2all/sdk

Type-safe TypeScript client for the post2all REST API.

## Install

```bash
pnpm add @post2all/sdk
```

## Create a post

```ts
import { Post2allClient } from "@post2all/sdk";

const client = new Post2allClient({
  apiKey: process.env.POST2ALL_API_KEY!,
});

const { post } = await client.createPost({
  type: "text",
  content: "New release shipping today 🚀",
  targets: [
    {
      platform: "discord",
      accountId: "acc_discord_123",
      settings: {
        channelId: "1234567890",
        autoCrosspost: true,
      },
    },
    {
      platform: "threads",
      accountId: "acc_threads_123",
      settings: {
        caption: "A shorter Threads version",
        topicTag: "buildinpublic",
      },
    },
  ],
  delivery: { mode: "now" },
});
```

`targets` is a discriminated union. Once `platform` is selected, TypeScript and Zod only accept settings supported by that platform.

## Delivery modes

```ts
await client.createPost({
  type: "text",
  content: "Work in progress",
  delivery: { mode: "draft" },
});

await client.createPost({
  type: "text",
  content: "Scheduled announcement",
  targets: [
    {
      platform: "linkedin",
      accountId: "acc_linkedin_123",
      settings: {},
    },
  ],
  delivery: {
    mode: "scheduled",
    scheduledAt: "2026-07-20T09:00:00+05:30",
  },
});
```

Drafts may omit targets and incomplete publishing settings. Immediate and scheduled delivery require valid targets, media, and all required platform settings.

## Account publishing options

Use account publishing options before rendering or submitting dynamic settings such as Discord channels or TikTok privacy choices:

```ts
const options = await client.getAccountPublishingOptions("acc_discord_123");
console.log(options.destinations);
```

## Media

```ts
const { media } = await client.uploadMedia("./video.mp4");

await client.createPost({
  type: "video",
  content: "Product walkthrough",
  mediaIds: [media.id],
  targets: [
    {
      platform: "youtube",
      accountId: "acc_youtube_123",
      settings: {
        title: "Product walkthrough",
        privacyStatus: "unlisted",
      },
    },
  ],
  delivery: { mode: "now" },
});
```

## API

- `listAccounts()`
- `getAccountPublishingOptions(accountId)`
- `uploadMedia(path)`
- `createMediaUpload(input)`
- `confirmMediaUpload(mediaId)`
- `createPost(input)`
- `listPosts(input?)`
- `getPost(postId)`
- `updatePost(postId, input)`
- `deletePost(postId)`
- `cancelPost(postId)`

## Errors

All API and response-validation failures throw `Post2allApiError`. Validation error responses may include field-level issues such as `targets.0.settings.channelId`.
