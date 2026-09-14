# post2all CLI

Official command-line client for the post2all REST API.

## Install and authenticate

```bash
pnpm add -g @post2all/cli
post2all config set-key amp_xxx
post2all config whoami
```

Credentials are resolved in this order: `--api-key`, `POST2ALL_API_KEY`, then `~/.config/post2all/config.json`.

Check the installed version with `post2all --version`. On interactive commands, the CLI checks npm for a newer release at most once every 24 hours and prints an update command when one is available. It never auto-installs updates, skips checks for `--json`/non-interactive usage, and can be disabled with `POST2ALL_DISABLE_UPDATE_CHECK=1`.

## Profiles

Business and Agency workspaces can organize accounts and posts into optional Profiles. Business supports 2 profiles; Agency supports up to 10 profiles.

```bash
post2all profile list
post2all profile create "Acme" --external-id customer_123
post2all profile get prof_123 --json
post2all profile update prof_123 --name "Acme Inc."
post2all profile delete prof_123
```

Use a named profile as the organization/filtering context for account/post commands with the global option:

```bash
post2all --profile-id prof_123 accounts --json
post2all --profile-id prof_123 posts --json
```

Assign an existing account to a profile or clear its profile assignment. Moving it changes where the account appears in profile-filtered lists; existing posts keep their target relationship:

```bash
post2all account profile acc_123 prof_123
post2all account profile acc_123 --clear
```

## Discover accounts

```bash
post2all constraints <accountId...> --json
post2all accounts --json
post2all account publishing-options acc_discord_123 --json
```

Call `constraints` once before composing to load every platform limit and connected-account text override. Use the returned account ID and platform when constructing targets. Per-account publishing options are only needed for dynamic choices such as Discord channels and TikTok privacy levels.

Treat publishing options as the source of truth for text, media, and field constraints. Limits can be account-specific—for example, X paid tiers receive a different text limit. Do not pass `--type`. Composition is inferred from attached media; mixed image/video is allowed only when platform `media.allowMixedMedia` is true. When `capability.media.altText` is present, use `--media` to set optional alt text on each media item. X intentionally does not expose that capability.

## Connect and manage accounts

List the connection methods currently available to your workspace:

```bash
post2all account platforms
```

Start an OAuth connection:

```bash
post2all account connect instagram \
  --redirect-url https://app.example.com/settings/social/complete
```

The CLI prints the provider authorization URL and a connection ID. Open the URL in the end user's browser. The user signs in directly with the social provider and does **not** need a post2all account or login session.

Check the authoritative result with:

```bash
post2all account connection <connectionId>
```

Other lifecycle commands:

```bash
post2all account get <accountId> --json
post2all account reconnect <accountId> --redirect-url https://app.example.com/settings/social/complete
post2all account disconnect <accountId>
```

Telegram prints a bot username and short-lived connection code instead of an OAuth URL. Wircle uses `--api-key` and `--profile-handle`.

For automation, add `--json` and keep the post2all API key on the trusted backend/CLI host rather than exposing it to browser code.

## Analytics

Read account-level analytics:

```bash
post2all account analytics acc_instagram_123 --json
post2all account analytics acc_instagram_123 \
  --start-date 2026-08-01 \
  --end-date 2026-08-31
```

Without dates, post2all uses the latest 30 inclusive UTC days; the maximum range is 90 days. Add `--refresh` only when you need fresh provider data instead of cached analytics.

Compare provider-wide posts:

```bash
post2all account analytics-posts acc_instagram_123 \
  --sort-by views \
  --sort-direction desc \
  --limit 20
```

Results can include content published directly on the provider. `origin=external` means the provider post was not matched to a post2all post.

Read per-target analytics for a post2all post:

```bash
post2all post analytics post_abc --json
```

Check `analyticsStatus` for each target; an empty metrics list can mean unavailable/no-data/reconnect-required rather than zero engagement.

## Create posts

The CLI accepts the same target structure as the REST API:

```bash
post2all post create \
  --content "New release shipping today 🚀" \
  --targets '[
    {
      "platform": "discord",
      "accountId": "acc_discord_123",
      "settings": {
        "channelId": "1234567890",
        "autoCrosspost": true
      }
    },
    {
      "platform": "threads",
      "accountId": "acc_threads_123",
      "settings": {
        "caption": "A shorter Threads version",
        "topicTag": "buildinpublic"
      }
    }
  ]' \
  --delivery now
```

Save an incomplete draft without any targets:

```bash
post2all post create \
  --content "Work in progress" \
  --delivery draft
```

Schedule a post using a timezone-aware ISO timestamp:

```bash
post2all post create \
  --content "Scheduled update" \
  --targets '[{"platform":"linkedin","accountId":"acc_linkedin_123","settings":{}}]' \
  --delivery scheduled \
  --scheduled-at "2026-07-20T09:00:00+05:30"
```

No delivery flag means `draft`. Immediate publishing is always explicit with `--delivery now`.

## Media

```bash
post2all media upload ./video.mp4 --json

post2all post create \
  --content "Product walkthrough" \
  --media '[{"id":"media_123","altText":"Product walkthrough showing the publishing workflow"}]' \
  --targets '[
    {
      "platform": "youtube",
      "accountId": "acc_youtube_123",
      "settings": {
        "title": "Product walkthrough",
        "privacyStatus": "unlisted"
      }
    }
  ]' \
  --delivery now
```

## Manage posts

```bash
post2all posts --status scheduled --limit 20 --json
post2all post get post_abc --json

post2all post update post_abc \
  --content "Updated copy" \
  --delivery scheduled \
  --scheduled-at "2026-07-21T10:00:00+05:30"

# Replace all destinations and settings
post2all post update post_abc \
  --targets '[{"platform":"linkedin","accountId":"acc_linkedin_123","settings":{}}]'

# Replace attached media and set per-media alt text
post2all post update post_abc \
  --media '[{"id":"media_456","altText":"Calendar view showing scheduled posts"}]'

post2all post cancel post_abc

# Inspect a post, then remove one published social post
post2all post get post_abc --json
post2all post delete-published post_abc --post-account-id post_account_1 --json

# Remove only the post2all record
post2all post delete post_abc
```

`post get --json` includes `deletion.available` and `deletion.reason` on each target. Use `post delete-published` only after `deletion.available` is `true` and the user confirms the destructive action. Private rollout platforms remain unavailable through the CLI. The post2all post stays intact.

`post delete` removes the record from post2all and cancels any pending schedule. Content already published to social platforms remains live there.

Draft, scheduled, failed, and partially failed posts can be updated while retained media is available. Arrays supplied to update replace their previous values.

## Main flags

| Flag                   | Description                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `--targets <json>`     | `PostTarget[]` containing `platform`, `accountId`, and platform-specific `settings`             |
| `--delivery <mode>`    | `draft`, `now`, or `scheduled`                                                                  |
| `--scheduled-at <iso>` | Required for scheduled delivery; must include `Z` or an explicit offset                         |
| `--media <json>`       | Preferred media array with managed `id` or public HTTPS `url`, plus optional per-item `altText` |
| `--media-ids <ids>`    | Deprecated compatibility input for comma-separated IDs from `media upload`                      |
| `--json`               | Return machine-readable JSON                                                                    |

`--status` remains as a deprecated alias for `draft`, `scheduled`, and `publish_now`; new integrations should use `--delivery`. Direct `url` media remains caller-managed and must stay reachable until publishing/retries complete. Do not send `--media` and `--media-ids` together.

Import a temporary/public URL into post2all-managed storage when you want post2all to retain its own copy:

```bash
post2all media upload \
  --url "https://temporary.example.com/video.mp4" \
  --filename video.mp4
```

For stable media that you already host, no import is required:

```bash
post2all post create \
  --media '[{"url":"https://cdn.example.com/video.mp4","altText":"Product demo"}]' \
  --delivery draft
```

## Documentation

- [Changelog](https://github.com/zexahq/post2all-sdk/blob/main/CHANGELOG.md)
- [Agent skill](https://www.skills.sh/zexahq/post2all-agent/post2all)
- [REST API reference](https://www.post2all.com/docs/api-reference)
