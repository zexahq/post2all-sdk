# post2all CLI

Official post2all command line interface.

## Install

```bash
pnpm add -g post2all
```

## Authentication

Set API key with one of these approaches:

```bash
# recommended for one-time setup
post2all config set-key amp_xxx

# per-shell
export POST2ALL_API_KEY=amp_xxx

# per-command
post2all --api-key amp_xxx accounts
```

Priority order is:

1. `--api-key`
2. `POST2ALL_API_KEY`
3. `~/.config/post2all/config.json`

## Commands

```bash
# validate key and show account/platform summary
post2all config whoami

# list connected social accounts
post2all accounts

# list posts (supports filters)
post2all posts --status published --limit 10

# get one post
post2all post get post_abc

# create a text post (publish immediately)
post2all post create \
  --type text \
  --accounts acc_1,acc_2 \
  --content "Hello from post2all CLI" \
  --status publish_now

# create a scheduled text post
post2all post create \
  --type text \
  --accounts acc_1,acc_2 \
  --content "Hello from post2all CLI" \
  --status scheduled \
  --scheduled-at "2026-03-10T09:00:00Z"

# save as draft
post2all post create \
  --type text \
  --accounts acc_1 \
  --content "Work in progress" \
  --status draft

# create an image post with media
post2all post create \
  --type image \
  --accounts acc_1 \
  --content "New image" \
  --media ./photo1.jpg ./photo2.jpg

# update a post
post2all post update post_abc \
  --content "Updated content" \
  --scheduled-at "2026-03-11T10:00:00Z"

# cancel a scheduled post
post2all post cancel post_abc

# delete a post
post2all post delete post_abc

# return raw JSON
post2all posts --json
```

## Publish (maintainers)

```bash
pnpm --filter @post2all/sdk build
pnpm --filter ./packages/cli typecheck
pnpm --filter ./packages/cli build
pnpm --filter ./packages/cli publish --access public
```
