import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_PUBLISHING_CONTRACT } from "../dist/generated/publishing-contract.js";
import {
  instagramSettingsSchema,
  platformSchema,
  postMediaInputSchema,
  postTargetsSchema,
  tiktokSettingsSchema,
  wircleSettingsSchema,
  youtubeSettingsSchema,
} from "../dist/types.js";

test("generated platform schema contains every published platform", () => {
  assert.equal(platformSchema.parse("bluesky"), "bluesky");
  assert.equal(platformSchema.parse("tiktok"), "tiktok");
  assert.equal(platformSchema.parse("wircle"), "wircle");
});

test("generated Wircle contract exposes the public text and image capabilities", () => {
  const wircle = PUBLIC_PUBLISHING_CONTRACT.platforms.wircle;

  assert.equal(wircle.releaseStatus, "public");
  assert.deepEqual(wircle.capability.postTypes, {
    text: true,
    image: true,
    video: false,
  });
  assert.equal(wircle.capability.text.maxLength, 4000);
  assert.equal(wircle.capability.media.maxImages, 4);
  assert.equal(wircle.capability.media.maxImageBytes, 10 * 1024 * 1024);
  assert.deepEqual(wircle.capability.fields, {});
  assert.deepEqual(wircleSettingsSchema.parse({}), {});
  assert.throws(() =>
    wircleSettingsSchema.parse({ caption: "not a target setting" }),
  );
  assert.deepEqual(
    postTargetsSchema.parse([
      { platform: "wircle", accountId: "account-wircle-1", settings: {} },
    ]),
    [{ platform: "wircle", accountId: "account-wircle-1", settings: {} }],
  );
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

test("generated contract exposes only public published deletion", () => {
  assert.equal(PUBLIC_PUBLISHING_CONTRACT.version, 1);
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.twitter.publishedDeletion.available,
    true,
  );
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.threads.publishedDeletion.available,
    false,
  );
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.youtube.publishedDeletion.available,
    false,
  );
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.instagram.publishedDeletion.available,
    false,
  );
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.tiktok.publishedDeletion.available,
    false,
  );
});

test("generated contract exposes per-media alt text without target-level alt text", () => {
  assert.deepEqual(
    PUBLIC_PUBLISHING_CONTRACT.platforms.linkedin.capability.media.altText,
    {
      mediaTypes: ["image"],
      maxLength: 4086,
    },
  );
  assert.deepEqual(
    PUBLIC_PUBLISHING_CONTRACT.platforms.threads.capability.media.altText,
    {
      mediaTypes: ["image", "video"],
      maxLength: 1000,
    },
  );
  assert.equal(
    PUBLIC_PUBLISHING_CONTRACT.platforms.twitter.capability.media.altText,
    undefined,
  );
  assert.equal(
    postMediaInputSchema.parse({ id: "media_1", altText: "Dashboard overview" })
      .altText,
    "Dashboard overview",
  );
  assert.throws(() =>
    instagramSettingsSchema.parse({ altText: "legacy target alt" }),
  );
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
