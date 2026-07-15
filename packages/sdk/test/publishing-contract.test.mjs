import assert from "node:assert/strict";
import test from "node:test";
import {
  platformSchema,
  tiktokSettingsSchema,
  youtubeSettingsSchema,
} from "../dist/types.js";

test("generated platform schema contains every published platform", () => {
  assert.equal(platformSchema.parse("bluesky"), "bluesky");
  assert.equal(platformSchema.parse("tiktok"), "tiktok");
});

test("generated settings enforce fixed enum values and field limits", () => {
  assert.equal(
    youtubeSettingsSchema.parse({ privacyStatus: "unlisted" }).privacyStatus,
    "unlisted",
  );
  assert.throws(() =>
    youtubeSettingsSchema.parse({ privacyStatus: "friends" }),
  );
  assert.throws(() => youtubeSettingsSchema.parse({ title: "x".repeat(101) }));
});

test("generated schemas remain strict and retain dynamic enum validation", () => {
  assert.throws(() => youtubeSettingsSchema.parse({ unknown: true }));
  assert.equal(
    tiktokSettingsSchema.parse({ tiktokPrivacyLevel: "SELF_ONLY" })
      .tiktokPrivacyLevel,
    "SELF_ONLY",
  );
  assert.throws(() =>
    tiktokSettingsSchema.parse({ tiktokPrivacyLevel: "PRIVATE" }),
  );
});
