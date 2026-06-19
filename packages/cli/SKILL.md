---
name: post2all
description: Schedule and publish social media posts across Twitter/X, LinkedIn, Instagram, YouTube, Pinterest, and Threads from the terminal.
allowed-tools: Bash(post2all:*)
---

## Install

```bash
pnpm add -g @post2all/cli
# or
npm install -g @post2all/cli
```

npm: https://www.npmjs.com/package/@post2all/cli
docs: https://www.post2all.com/docs/api-reference

---

## ⚠️ Two Hard Rules

**Rule 1 — Authenticate first.** Every command fails without valid credentials. Set up once:

```bash
post2all config set-key amp_xxx
post2all config whoami   # verify it works
```

**Rule 2 — Image/video posts need `--media`.** Local file paths work directly (no pre-upload needed).

**Rule 3 — Scheduled times must include a timezone.** `--scheduled-at` must be an ISO 8601 date-time with `Z` or an explicit offset. Never use timezone-less values like `2026-06-20T09:00:00`.

If the user says a local time, interpret it in the user's local timezone unless they explicitly name another timezone. Check the current local timezone before scheduling:

```bash
date +"%Y-%m-%d %H:%M:%S %Z (%z)"
```

Examples:

```bash
# 9:00 AM in India Standard Time
--scheduled-at "2026-06-20T09:00:00+05:30"

# Same instant in UTC
--scheduled-at "2026-06-20T03:30:00Z"
```

If the user's timezone is unknown or the request is ambiguous, ask one clarifying question before scheduling.

---

## Authentication

Three layers, highest priority first:

```bash
# 1. Per-command flag
post2all --api-key amp_xxx accounts

# 2. Environment variable
export POST2ALL_API_KEY=amp_xxx

# 3. Persistent config (recommended)
post2all config set-key amp_xxx
```

API keys are created in **Settings → API Keys** in the post2all dashboard.

---

## Complete Command Reference

### Auth & Config

```bash
# Store API key permanently (~/.config/post2all/config.json)
post2all config set-key <apiKey>

# Validate key and show connected accounts summary
post2all config whoami
post2all config whoami --json
```

### Discovery

```bash
# List all connected social accounts with platform info
post2all accounts
post2all accounts --json

# Each account returned includes:
#   id, platform, username, displayName, status,
#   supportedPostTypes: { text, image, video }
```

### Create Posts

```bash
# Publish a text post immediately
post2all post create \
  --type text \
  --accounts acc_1,acc_2 \
  --content "Hello from post2all CLI"

# Publish immediately (explicit)
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Hello" \
  --status publish_now

# Schedule for later
post2all post create \
  --type text \
  --accounts acc_1,acc_2 \
  --content "Scheduled post" \
  --status scheduled \
  --scheduled-at "2026-06-15T09:00:00+05:30"

# Save as draft
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Work in progress" \
  --status draft

# Image post (local files — no pre-upload needed)
post2all post create \
  --type image \
  --accounts acc_1 \
  --content "Check this out" \
  --media ./photo1.jpg ./photo2.jpg

# Video post
post2all post create \
  --type video \
  --accounts acc_1 \
  --content "My video" \
  --media ./video.mp4

# Platform-specific settings
post2all post create \
  --type text \
  --accounts acc_1,acc_2 \
  --content "Platform-specific post" \
  --platform-settings '{"twitter":{"caption":"Short Twitter/X version"},"youtube":{"title":"YouTube title"}}'

# Machine-readable output
post2all post create --type text --accounts acc_1 --content "Test" --json
```

**Create flags:**
| Flag | Required | Values | Notes |
|------|----------|--------|-------|
| `--type` | Yes | `text`, `image`, `video` | |
| `--accounts` | Yes | Comma-separated IDs | From `post2all accounts` |
| `--content` | No | String | Required for text posts |
| `--status` | No | `publish_now`, `scheduled`, `draft` | Default: publish immediately |
| `--scheduled-at` | No | ISO 8601 date-time with `Z` or timezone offset | Required for `--status scheduled`; never omit the timezone |
| `--media` | No | One or more file paths | Required for image/video posts |
| `--platform-settings` | No | JSON object | Platform-specific content overrides |
| `--json` | No | Flag | Output as JSON |

### Read Posts

```bash
# Get full post details (content, status, per-platform/account publish results)
post2all post get <postId>
post2all post get <postId> --json

# List posts with filters
post2all posts
post2all posts --status published --limit 10
post2all posts --type image --page 2
post2all posts --status scheduled --json

# List with pagination
post2all posts --page 1 --limit 20
```

**List filters:**
| Flag | Values |
|------|--------|
| `--page` | Page number (default: 1) |
| `--limit` | Items per page (default: 20, max: 100) |
| `--status` | `draft`, `scheduled`, `published`, `partially_failed`, `failed` |
| `--type` | `text`, `image`, `video` |

### Update Posts

```bash
# Update content
post2all post update <postId> --content "Updated text"

# Change schedule
post2all post update <postId> --scheduled-at "2026-06-20T10:00:00+05:30"

# Change target accounts
post2all post update <postId> --accounts acc_1,acc_2

# Change post type
post2all post update <postId> --type image
```

Only **draft** or **scheduled** posts can be updated.

### Manage Post Status

```bash
# Move scheduled post back to draft (cancels pending publish)
post2all post cancel <postId>

# Toggle status directly
post2all post status <postId> --status draft
post2all post status <postId> --status scheduled
```

### Delete Posts

```bash
# Permanently delete (cancels schedule, removes media)
post2all post delete <postId>
```

---

## Platform Character Limits

| Platform    | Max chars |
|-------------|-----------|
| Twitter / X | 280       |
| LinkedIn    | 3,000     |
| Instagram   | 2,200     |
| YouTube     | 5,000     |
| Threads     | 500       |
| Pinterest   | 500       |

Content is validated server-side. Exceeding limits returns an error with the specific platform that failed.

---

## Supported Media Formats

| Type  | Formats                                          |
|-------|--------------------------------------------------|
| Image | jpg, jpeg, png, gif, webp, svg                   |
| Video | mp4, webm, mov, avi, mkv                          |

Use `--media` with local file paths. Files are uploaded inline — no separate upload step required.

---

## Common Patterns

### Pattern 1: Quick Publish

```bash
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Quick update"
```

No `--status` or `--scheduled-at` needed — publishes immediately by default.

### Pattern 2: Discover → Create Workflow

```bash
# Step 1: List available accounts
ACCOUNTS=$(post2all accounts --json | jq -r '.accounts[].id')
echo "$ACCOUNTS"

# Step 2: Pick target account and create post
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Hello world"
```

### Pattern 3: Draft → Review → Schedule

```bash
# 1. Save as draft
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Draft content" \
  --status draft

# 2. Review later
post2all post get post_abc

# 3. Update and schedule
post2all post update post_abc --content "Final version"
post2all post status post_abc --status scheduled \
  --scheduled-at "2026-06-20T09:00:00+05:30"
```

Wait — `post status` only takes `--status`, not `--scheduled-at`. For scheduling a draft, use `post update`.

```bash
# Correct: schedule a draft
post2all post update post_abc \
  --status scheduled \
  --scheduled-at "2026-06-20T09:00:00+05:30"
```

### Pattern 4: Cancel a Scheduled Post

```bash
# Move scheduled → draft, cancels the publish trigger
post2all post cancel post_abc
# or
post2all post status post_abc --status draft
```

### Pattern 5: Image Post with Multiple Files

```bash
post2all post create \
  --type image \
  --accounts acc_1 \
  --content "Photo gallery" \
  --media ./photo1.jpg ./photo2.jpg ./photo3.jpg
```

### Pattern 6: Scripted Batch Posts

```bash
#!/bin/bash

POSTS=(
  "Morning update|2026-06-20T08:00:00+05:30"
  "Afternoon tip|2026-06-20T14:00:00+05:30"
  "Evening recap|2026-06-20T20:00:00+05:30"
)

for entry in "${POSTS[@]}"; do
  IFS='|' read -r content date <<< "$entry"
  post2all post create \
    --type text \
    --accounts acc_1 \
    --content "$content" \
    --status scheduled \
    --scheduled-at "$date"
  echo "Scheduled: $content at $date"
done
```

### Pattern 7: Error Handling in Scripts

```bash
#!/bin/bash

if ! post2all post create \
  --type text \
  --accounts acc_1 \
  --content "$CONTENT"; then
  echo "Post failed — check your API key and account IDs"
  post2all config whoami  # verify auth still works
  exit 1
fi

echo "Post created successfully"
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Error (API failure, auth failure, or invalid input) |

---

## Error Reference

| API Error Code | HTTP | Cause | Fix |
|----------------|------|-------|-----|
| `INVALID_API_KEY` | 401 | Missing or invalid `x-api-key` | Run `post2all config set-key` with valid key |
| `EXPIRED_API_KEY` | 401 | Key has expired | Create a new key in dashboard Settings |
| `RATE_LIMITED` | 429 | Too many requests | Wait and retry |
| `FORBIDDEN` | 403 | Key doesn't have org access | Check key belongs to current workspace |
| `PLAN_UPGRADE_REQUIRED` | 403 | No active subscription or monthly post limit reached | Check subscription status in dashboard |
| `INVALID_REQUEST` | 400 | Missing fields or bad body | Check `--help` for required flags |
| `INVALID_ACCOUNTS` | 400 | Account ID doesn't belong to org | Run `post2all accounts` for valid IDs |
| `UNSUPPORTED_MEDIA` | 400 | File type not image/* or video/* | Check supported formats above |
| `POST_NOT_FOUND` | 404 | Post ID not found | Check ID from `post2all posts` |
| `INTERNAL_ERROR` | 500 | Server error | Retry or contact support |

---

## Quick Reference

```bash
# Setup (one time)
post2all config set-key amp_xxx
post2all config whoami

# Discovery
post2all accounts

# Create
post2all post create --type text --accounts acc_1 --content "Hello"

# Schedule
post2all post create --type text --accounts acc_1 --content "Later" \
  --status scheduled --scheduled-at "2026-06-20T09:00:00+05:30"

# Draft
post2all post create --type text --accounts acc_1 --content "WIP" --status draft

# With media
post2all post create --type image --accounts acc_1 \
  --content "Photo" --media ./photo.jpg

# List
post2all posts
post2all posts --status scheduled --limit 10

# Read
post2all post get post_abc

# Update
post2all post update post_abc --content "New text"

# Status toggle
post2all post status post_abc --status scheduled
post2all post cancel post_abc

# Delete
post2all post delete post_abc

# Help
post2all --help
post2all post create --help
```
