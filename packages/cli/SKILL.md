---
name: post2all
description: Create, schedule, inspect, update, cancel, and delete social posts through the post2all CLI.
allowed-tools: Bash(post2all:*)
---

# post2all CLI

Use the CLI to manage social posts through the post2all REST API.

## Safety and authentication

Validate credentials before acting:

```bash
post2all config whoami --json
```

Credentials are resolved from `--api-key`, `POST2ALL_API_KEY`, or `post2all config set-key`. Never print, repeat, or commit API keys.

Before composing, previewing, scheduling, or publishing, load all current constraints once:

```bash
post2all constraints <accountId...> --json
```

After selecting accounts, run `post2all constraints <accountId...> --json`. Use its capabilities, fixed field values, and account-specific limits. Fetch publishing options only when the response contains discovery keys.

List connected accounts before creating targets. Never guess an account ID or platform:

```bash
post2all accounts --json
```

Use drafts for review-oriented requests. Publish immediately only when the user explicitly requests it. Confirm destructive deletes unless the user already clearly identified the post and requested deletion.

## Canonical target model

Every publishing destination is a target:

```json
{
  "platform": "discord",
  "accountId": "acc_discord_123",
  "settings": {
    "channelId": "1234567890",
    "autoCrosspost": true
  }
}
```

`platform` is a schema discriminator. Settings from another platform are rejected. Multiple accounts on the same platform are represented as separate target objects.

Use account publishing options only when a selected account needs dynamic settings:

```bash
post2all account publishing-options <accountId...> --json
```

This is required before selecting values such as a Discord channel or TikTok privacy level.

Use `post2all constraints <accountId...> --json` as the authoritative selected-account publishing schema. Per-account publishing options are for dynamic choices such as Discord channels and TikTok creator restrictions. The API currently requires one post type and does not accept mixed image/video media.

## Delivery modes

- `draft`: save without publishing; targets and incomplete settings may be omitted.
- `now`: publish immediately; requires at least one complete target.
- `scheduled`: publish later; requires complete targets and `--scheduled-at`.

No delivery flag defaults to `draft`.

Scheduled timestamps must be ISO 8601 with `Z` or an explicit offset:

```bash
--scheduled-at "2026-07-20T09:00:00+05:30"
```

Never use a timezone-less timestamp. Resolve relative dates in the user's timezone and make the resulting timestamp clear.

## Create posts

Draft:

```bash
post2all post create \
  --type text \
  --content "Work in progress" \
  --delivery draft \
  --json
```

Immediate publish:

```bash
post2all post create \
  --type text \
  --content "New release shipping today 🚀" \
  --targets '[
    {
      "platform": "linkedin",
      "accountId": "acc_linkedin_123",
      "settings": {}
    },
    {
      "platform": "threads",
      "accountId": "acc_threads_123",
      "settings": {
        "caption": "Short Threads version",
        "topicTag": "buildinpublic"
      }
    }
  ]' \
  --delivery now \
  --json
```

Scheduled post:

```bash
post2all post create \
  --type text \
  --content "Scheduled update" \
  --targets '[{"platform":"linkedin","accountId":"acc_linkedin_123","settings":{}}]' \
  --delivery scheduled \
  --scheduled-at "2026-07-20T09:00:00+05:30" \
  --json
```

## Media workflow

Upload local files first and use the returned media IDs:

```bash
post2all media upload ./photo.jpg --json

post2all post create \
  --type image \
  --media-ids media_123 \
  --content "Photo update" \
  --targets '[{"platform":"instagram","accountId":"acc_instagram_123","settings":{"altText":"Product dashboard"}}]' \
  --delivery now \
  --json
```

Use `--type video` for videos. Do not pass local paths directly to post creation.

## Platform settings

Supported target settings include:

- Twitter/X: `caption`, `altText`
- LinkedIn: `caption`
- YouTube: `caption`, `title`, `description`, `tags`, `privacyStatus`, `categoryId`, `thumbnail`, `thumbnailTimestamp`
- Instagram: `caption`, `altText`, `thumbnail`, `thumbnailTimestamp`
- Facebook: `caption`
- Pinterest: `caption`, `boardId`, `altText`, `thumbnail`, `thumbnailTimestamp`
- Threads: `caption`, `altText`, `topicTag`
- Dribbble: `caption`, `title`, `description`, `tags`, `teamId`, `lowProfile`
- Bluesky: `caption`, `altText`
- Telegram: `caption`, `linkUrl`, `linkText`, `disableNotification`, `protectContent`
- Discord: `caption`, `channelId`, `autoCrosspost`
- TikTok: `caption`, `title`, `description`, `tiktokContentPostingMethod`, `tiktokPrivacyLevel`, `tiktokDisableComment`, `tiktokDisableDuet`, `tiktokDisableStitch`

For TikTok, `tiktokContentPostingMethod` is `DIRECT_POST` or `UPLOAD`. Upload sends media to the creator's TikTok inbox for editing and is reported as a successful `completed` post with an `uploaded` target.

Do not invent fields. Prefer the main content for shared copy and use target `caption` only for account-specific overrides.

## Read and update posts

```bash
post2all posts --status scheduled --limit 100 --json
post2all post get <postId> --json
```

Only draft and scheduled posts can be updated. Supplied target and media arrays replace their previous values:

```bash
post2all post update <postId> \
  --content "Revised copy" \
  --targets '[{"platform":"linkedin","accountId":"acc_linkedin_123","settings":{}}]' \
  --delivery scheduled \
  --scheduled-at "2026-07-21T10:00:00+05:30" \
  --json
```

Move a scheduled post back to draft:

```bash
post2all post cancel <postId> --json
```

Publish an existing draft immediately:

```bash
post2all post update <postId> --delivery now --json
```

Delete permanently:

```bash
post2all post get <postId> --json
post2all post delete <postId> --json
```

## Status filters

Valid post statuses are `draft`, `scheduled`, `publishing`, `published`, `completed`, `partially_failed`, and `failed`. A `completed` post succeeded but includes at least one upload-only target that still needs user action in the platform app.

## Errors

- `INVALID_API_KEY` / `EXPIRED_API_KEY`: configure a valid key.
- `INVALID_ACCOUNTS`: refresh account IDs and verify each target's platform matches the account.
- `INVALID_REQUEST`: inspect field-level issue paths and correct the target or delivery.
- `MEDIA_NOT_FOUND`: upload again or use valid media IDs from the current workspace.
- `UNSUPPORTED_MEDIA`: verify post type, file type, size, and selected platforms.
- `POST_NOT_FOUND`: refresh the post list.
- `PLAN_UPGRADE_REQUIRED` / `FORBIDDEN`: explain the account or plan restriction rather than retrying.
- `RATE_LIMITED`: wait before retrying.

Use `--json` whenever output will be parsed or used by another command.
