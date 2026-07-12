# post2all CLI

Official command-line client for the post2all REST API.

## Install and authenticate

```bash
pnpm add -g @post2all/cli
post2all config set-key amp_xxx
post2all config whoami
```

Credentials are resolved in this order: `--api-key`, `POST2ALL_API_KEY`, then `~/.config/post2all/config.json`.

## Discover accounts

```bash
post2all accounts --json
post2all account publishing-options acc_discord_123 --json
```

Use the returned account ID and platform when constructing targets. Publishing options include platform capabilities and dynamic choices such as Discord channels and TikTok privacy levels.

## Create posts

The CLI accepts the same target structure as the REST API:

```bash
post2all post create \
  --type text \
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
  --type text \
  --content "Work in progress" \
  --delivery draft
```

Schedule a post using a timezone-aware ISO timestamp:

```bash
post2all post create \
  --type text \
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
  --type video \
  --content "Product walkthrough" \
  --media-ids media_123 \
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

# Replace attached media
post2all post update post_abc --media-ids media_456

post2all post cancel post_abc
post2all post delete post_abc
```

Only draft and scheduled posts can be updated. Arrays supplied to update replace their previous values.

## Main flags

| Flag                   | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `--targets <json>`     | `PostTarget[]` containing `platform`, `accountId`, and platform-specific `settings` |
| `--delivery <mode>`    | `draft`, `now`, or `scheduled`                                                      |
| `--scheduled-at <iso>` | Required for scheduled delivery; must include `Z` or an explicit offset             |
| `--media-ids <ids>`    | Comma-separated IDs returned by `media upload`                                      |
| `--json`               | Return machine-readable JSON                                                        |

`--status` remains as a deprecated alias for `draft`, `scheduled`, and `publish_now`; new integrations should use `--delivery`.

## Documentation

- [Agent skill](./SKILL.md)
- [REST API reference](https://www.post2all.com/docs/api-reference)
