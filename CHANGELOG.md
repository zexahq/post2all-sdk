# Changelog

All notable changes to the post2all SDK and CLI are documented here.

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
