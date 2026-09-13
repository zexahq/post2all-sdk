# @post2all/sdk

Type-safe TypeScript client for the post2all REST API.

Full guides and examples: [post2all TypeScript SDK documentation](https://www.post2all.com/docs/sdk).

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

Platform IDs, settings fields, fixed enums, limits, static account-connection metadata, the `publishedDeletion.available` capability, and sanitized analytics schema metadata are generated from the private monorepo's public contract. Do not edit the generated contract file in this repository; the release synchronization job regenerates it.

## Connect social accounts from your SaaS

post2all can be the social-account backend for your own product. Your server keeps the post2all API key; the end user's browser only visits the social provider authorization page and your own callback URL.

```ts
const started = await client.connectAccount("instagram", {
  redirectUrl: "https://app.example.com/settings/social/complete",
});

// Send the user's browser to started.authorizationUrl.
console.log(started.connectionId, started.authorizationUrl);
```

The user does **not** need a post2all account, post2all login, or post2all browser session. After the provider callback, post2all returns the browser to your `redirectUrl`. Verify the authoritative result from your backend:

```ts
const connection = await client.getAccountConnection(started.connectionId);

if (connection.status === "connected") {
  const account = await client.getAccount(connection.accountIds[0]);
  console.log(account.account);
}
```

Never expose your post2all API key in browser code. The browser redirect is a UX handoff; use `getAccountConnection()` server-side before trusting the result.

Reconnect the exact provider identity later if credentials expire or scopes change:

```ts
const reconnect = await client.reconnectAccount("acc_instagram_123", {
  redirectUrl: "https://app.example.com/settings/social/complete",
});
```

post2all rejects a reconnect if the newly authorized provider identity does not match the existing account.

### Profiles for clients and SaaS tenants

Business and Agency workspaces can keep clients, brands, or customers in optional Profiles. Business supports up to 2 profiles; Agency supports up to 10 profiles.

```ts
const { profile } = await client.createProfile({
  name: "Acme",
  externalId: "customer_123",
});
const acme = client.forProfile(profile.id);
const accounts = await acme.listAccounts();
```

The profile client sends `x-profile-id` automatically. It is an organization/filtering context, not a separate security credential: profile-aware lists are filtered, new connections are assigned to that profile, and new posts are organized under it. Profile management remains organization-scoped.

Move an account with `setAccountProfile(accountId, profileId)` or pass `null` to clear its profile assignment. Each account belongs to at most one profile at a time. Moving an account does not move historical posts or break existing drafts, schedules, retries, analytics, or post targets. Deleting a profile preserves its accounts and posts as profile-less resources.

The recommended SaaS pattern is to keep one root client for organization-level profile management, then use one scoped client per customer:

```ts
const root = new Post2allClient({
  apiKey: process.env.POST2ALL_API_KEY!,
});

const { profile } = await root.createProfile({
  name: "Acme",
  externalId: "customer_123",
});

const acme = root.forProfile(profile.id);

const started = await acme.connectAccount("instagram", {
  redirectUrl: "https://app.example.com/social/complete",
});

const { accounts } = await acme.listAccounts();
const posts = await acme.listPosts();
```

Omitting profile context means the complete workspace. `externalId` is optional and is intended for mapping a post2all profile to your own customer or tenant ID. Keep the workspace API key on your trusted backend; the workspace remains the authorization boundary.

Telegram uses the same API with a bot-code response, and Wircle accepts credentials directly:

```ts
const telegram = await client.connectAccount("telegram");

const wircle = await client.connectAccount("wircle", {
  credentials: {
    apiKey: process.env.WIRCLE_API_KEY!,
    profileHandle: "@maker",
  },
});
```

## Delivery modes

```ts
await client.createPost({
  content: "Work in progress",
  delivery: { mode: "draft" },
});

await client.createPost({
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

Load the selected-account schema once before composing:

```ts
const schema = await client.getPublishingSchema([accountId]);
console.log(schema.accounts); // Fixed choices and account-specific limits, including X tiers
```

Use account publishing options before rendering or submitting dynamic settings such as Discord channels or TikTok privacy choices:

```ts
const options = await client.getPublishingOptions(["acc_discord_123"]);
console.log(options.accounts[0]?.destinations);
console.log(options.accounts[0]?.boards);
```

`capability` is the authoritative, account-specific constraint set. Read it before composing or validating a post instead of hard-coding platform limits. For example, an X account's `capability.text.maxLength` reflects whether that account is Free, Basic, Premium, or Premium+.

Do not send a fixed post type. Composition is inferred from attached media. Mixed image/video is allowed only when platform `media.allowMixedMedia` is true. When `capability.media.altText` is present, each attached media item may include its own `altText`; use the returned media types and maximum length. X intentionally does not expose media alt text.

## Analytics

Read normalized account metrics, time series, provider metric definitions, and previous-period comparisons:

```ts
const analytics = await client.getAccountAnalytics("acc_instagram_123", {
  startDate: "2026-08-01",
  endDate: "2026-08-31",
});

console.log(analytics.metrics);
console.log(analytics.comparisons);
```

The default range is the latest 30 inclusive UTC days and the maximum range is 90 days. Pass `refresh: true` only when you explicitly need fresh provider data instead of the normal analytics cache.

Compare provider-wide post performance:

```ts
const posts = await client.listAccountAnalyticsPosts("acc_instagram_123", {
  sortBy: "views",
  sortDirection: "desc",
  limit: 20,
});
```

Supported platforms can return posts that were published outside post2all. Use `origin` to distinguish matched post2all posts from `external` provider posts; unmatched external posts intentionally omit `postId` and `postAccountId`.

Read analytics for every target of a post2all post:

```ts
const result = await client.getPostAnalytics("post_abc");
```

Inspect each target's `analyticsStatus` before interpreting an empty metrics array. Unavailable provider data, reconnect requirements, unpublished targets, and provider errors are not zero engagement.

## Retry failed post targets

Retry a failed or partially failed post without republishing successful targets:

```ts
await client.retryPost("post_abc");
```

Schedule only the failed-target retry for later when needed:

```ts
await client.retryPost("post_abc", {
  scheduledAt: "2026-09-21T14:00:00+05:30",
});
```

For example, if Instagram and YouTube succeeded but TikTok failed, `retryPost()` publishes only the failed TikTok target.

## Media

```ts
const { media } = await client.uploadMedia("./video.mp4");

await client.createPost({
  content: "Product walkthrough",
  media: [
    {
      id: media.id,
      altText: "Product walkthrough showing the publishing workflow",
    },
  ],
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

`mediaIds` remains accepted for compatibility when you only need to attach media IDs. New integrations should prefer `media`, especially when setting per-media alt text. Do not send both in one request.

## API

- `listProfiles(input?)`
- `getProfile(profileId)`
- `createProfile(input)`
- `updateProfile(profileId, input)`
- `deleteProfile(profileId)`
- `forProfile(profileId)`
- `listAccounts()`
- `listAccountPlatforms()`
- `connectAccount(platform, input?)`
- `getAccountConnection(connectionId)`
- `getAccount(accountId)`
- `reconnectAccount(accountId, input?)`
- `disconnectAccount(accountId)`
- `setAccountProfile(accountId, profileId)`
- `getAccountAnalytics(accountId, input?)`
- `listAccountAnalyticsPosts(accountId, input?)`
- `getPublishingSchema(accountIds)`
- `getPublishingOptions(accountIds)`
- `getAccountPublishingOptions(accountId)` (compatibility)
- `uploadMedia(path)`
- `createMediaUpload(input)`
- `confirmMediaUpload(mediaId)`
- `createPost(input)`
- `listPosts(input?)`
- `getPost(postId)`
- `getPostAnalytics(postId, input?)`
- `updatePost(postId, input)`
- `retryPost(postId, input?)` — retries only failed targets and can optionally schedule that retry
- `deletePublishedPost(postId, postAccountId)` — removes one published social post on a public deletion platform while keeping the post2all post
- `deletePost(postId)` — removes the post from post2all; already-published social content remains live
- `cancelPost(postId)`

Use `getPost(postId)` first and check `target.deletion.available`. When it is `false`, `target.deletion.reason` explains why. This runtime state already includes platform rollout, account state, provider IDs, and time limits. Private rollout platforms are never unlocked through API keys.

## Errors

All API and response-validation failures throw `Post2allApiError`. Validation error responses may include field-level issues such as `targets.0.settings.channelId`.

## Changelog

See the repository [changelog](https://github.com/zexahq/post2all-sdk/blob/main/CHANGELOG.md) for versioned SDK and CLI changes, deprecations, and compatibility notes.
