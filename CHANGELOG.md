# Changelog

All notable changes to the post2all SDK and CLI are documented here.

## 0.4.3 - 2026-11-04

### Added

- Instagram through Facebook Login in headless connections. `connectAccount("instagram", { connectionMethod: "facebook_login" })` and `post2all account connect instagram --connection-method facebook_login` sign the end user in with Facebook and connect every eligible Instagram professional account linked to the Facebook Pages they manage, which is the method that unlocks Reel audio. The default `instagram_login` connects one account directly, as before. Reconnects keep the account's existing method, so Instagram accounts connected through Facebook Login can now also be reconnected from the API, SDK, and CLI.
- `listAccountPlatforms()` reports Instagram's selectable methods under `connectionMethods`; the `instagramConnectionMethodSchema` export and `InstagramConnectionMethod` type are derived from the generated contract.

## 0.4.1 - Unreleased

### Added

- Instagram and Facebook Stories. Instagram and Facebook settings accept `placement: "feed" | "story"` (default `feed`). A Story publishes one image or video for 24 hours; the generated contract and `getPublishingSchema()` expose its limits as `capability.story.media` and list the settings a Story cannot use in `capability.story.unsupportedFields`. Stories never show the post text.
- `PUBLIC_PUBLISHING_CONTRACT.version` is now `5`.

## 0.4.0 - 2026-11-02

### Added

- First comments are public on X, Instagram, Facebook Pages, Threads, Bluesky, and Wircle targets. The generated contract now exposes `firstComment` (text, per-platform limit) and `firstCommentDelaySeconds` (integer 0–86400) in those platforms' settings schemas, and `getPublishingSchema()` reports per-account `firstComment: { available, reason }`.
- Added `retryFirstComment(postId, postAccountId)` and `cancelFirstComment(postId, postAccountId)` SDK methods, plus the `post first-comment-retry` and `post first-comment-cancel` CLI commands.

- Added typed social-account lifecycle SDK methods: `listAccountPlatforms`, `connectAccount`, `getAccountConnection`, `getAccount`, `reconnectAccount`, and `disconnectAccount`.
- Added CLI commands for starting OAuth/Telegram/Wircle connections, checking connection status, reconnecting exact provider identities, inspecting accounts, and disconnecting accounts.
- Added headless OAuth support for third-party SaaS integrations: end users can authorize social accounts without a post2all account or login session, then return to the caller's own redirect URL.
- Added typed SDK analytics methods: `getAccountAnalytics`, `listAccountAnalyticsPosts`, and `getPostAnalytics`.
- Added CLI analytics commands for account overview, provider-wide account posts, and per-target post analytics.
- Added typed analytics metric definitions, comparison data, pagination, refresh controls, and per-target availability statuses.
- Added Mastodon as a public platform. Connect with `connectAccount("mastodon", { handle: "you@mastodon.social" })` or `post2all account connect mastodon --handle you@mastodon.social`; the handle (or bare server) selects the Mastodon server to authorize against.
- Added the `mastodonSettingsSchema` export and `MastodonSettings` type for Mastodon targets: `mastodonVisibility` (`public`, `unlisted`, `private`), `contentWarning`, and `sensitive`.
- Added Slack as a public platform. Connect with `connectAccount("slack")` or `post2all account connect slack`; the authorization URL installs the post2all app into the workspace the user picks, and that workspace becomes the connected account.
- Added the `slackSettingsSchema` export and `SlackSettings` type for Slack targets: `channelId` (required; choose from the `destinations` returned by publishing options) and `unfurlLinks` (defaults to `true`).

### Changed

- Shared `content` is no longer required when every target carries its own `settings.caption`; each platform publishes its caption in place of the shared text. Media-less posts with any target missing a caption are still rejected.

### Notes

- Account OAuth redirects expose only safe completion identifiers/status. Provider tokens remain server-side, and reconnects reject mismatched provider identities.
- `redirectUrl` must use HTTPS except loopback HTTP for local development and is limited to 2048 characters.
- Account analytics default to the latest 30 inclusive UTC days and accept ranges up to 90 days.
- Provider-wide account post analytics can include posts published outside post2all when supported; these are identified by `origin: "external"`.
- Slack messages hold up to 4,000 characters and up to 10 files uploaded natively to the workspace (images up to 20 MB, videos up to 200 MB, mixed freely). Public channels post right away; invite the post2all app to a private channel first. Published-post deletion is available for Slack targets.
- Mastodon character limits are per server (500 by default) and reported per account in the publishing schema; links count as 23 characters and the content warning counts toward the limit. Media is up to 4 images (8 MB each) or 1 video (40 MB), not mixed. Published-post deletion is available for Mastodon targets.
- TikTok targets require post2all-managed media (`capability.media.requiresManagedMedia`); attach uploaded media by `id` rather than direct `url`.
- The generated public contract now also carries sanitized analytics schema metadata (ranges, sort keys, metric keys, formats, and public statuses) so SDK/CLI validation stays aligned with the monorepo contract source.

## 0.3.0 - 2026-08-18

### Added

- Added preferred per-media metadata through `media`, including optional `media[].altText`.
- Added generated `capability.media.altText` discovery so clients can check supported media types and platform-specific limits before sending alt text.
- Added CLI `--media <json>` support for per-media metadata on create and update operations.
- Added a non-blocking CLI update notice for interactive users. The check is cached for 24 hours, skipped for `--json` and non-interactive sessions, and can be disabled with `POST2ALL_DISABLE_UPDATE_CHECK=1`.
- Added CLI client identification and version headers so post2all can distinguish CLI-created posts from direct REST API usage.

### Changed

- New SDK, CLI, REST, and agent examples use the preferred `media: [{ id, altText? }]` shape.
- X intentionally does not expose media alt-text support.

### Deprecated

- Target-level `settings.altText` is deprecated. Existing server-side integrations that still send it remain supported as a compatibility fallback, but new clients should attach alt text to each media item instead.
- `mediaIds` / CLI `--media-ids` remain supported for compatibility with ID-only attachments. New integrations should prefer `media`, especially when attaching media metadata.

### Compatibility

- Existing REST and older CLI clients can continue using the previous request shapes.
- The new per-media fields are optional; clients that have not upgraded continue to publish without them.
