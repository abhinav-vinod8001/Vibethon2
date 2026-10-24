import assert from "node:assert/strict";
import test from "node:test";
import {
  TRANSLATION_BUNDLES,
  isTranslationBundle,
  sourceId,
  translationManifest,
} from "../src/i18n/catalog.ts";
import {
  validatePublishedMessages,
  validateTranslationMessages,
} from "../src/i18n/translation-validation.ts";

test("approved UI bundles have stable unique small IDs and no overlapping sources", () => {
  const seen = new Set();
  for (const bundle of TRANSLATION_BUNDLES) {
    const manifest = translationManifest(bundle);
    assert.ok(Object.keys(manifest).length > 0);
    for (const [id, source] of Object.entries(manifest)) {
      assert.match(id, /^s[a-f0-9]{8}$/);
      assert.equal(id, sourceId(source));
      assert.equal(
        seen.has(source),
        false,
        `duplicate bundle source: ${source}`,
      );
      seen.add(source);
    }
  }
  assert.ok(seen.has("Continue with Google"));
  assert.ok(seen.has("What name should appear on your resume?"));
  assert.ok(seen.size > 300);
  assert.equal(isTranslationBundle("custom prompt"), false);
  assert.equal(isTranslationBundle("workspace"), true);
});

test("translation validation preserves placeholders and accepts complete responses only", () => {
  const manifest = { s1: "Found {count} jobs", s2: "Pay {amount}" };
  const valid = { s1: "{count} ജോലികൾ", s2: "തുക {amount}" };
  assert.deepEqual(validateTranslationMessages(valid, manifest), {
    "Found {count} jobs": valid.s1,
    "Pay {amount}": valid.s2,
  });
  for (const invalid of [
    null,
    [],
    { s1: valid.s1 },
    { ...valid, unknown: "extra" },
    { ...valid, s2: "Missing amount" },
    { ...valid, s2: "{amount} {amount}" },
    { ...valid, s2: "{total}" },
    { ...valid, s2: " " },
    { ...valid, s2: 42 },
    { ...valid, s2: "x".repeat(501) },
  ])
    assert.equal(validateTranslationMessages(invalid, manifest), null);
});

test("published cache validation rejects stale, partial, and injected labels", () => {
  const manifest = { s1: "Sign in", s2: "Retry" };
  const messages = { "Sign in": "ഉൾപ്രവേശിക്കുക", Retry: "വീണ്ടും ശ്രമിക്കുക" };
  assert.deepEqual(validatePublishedMessages(messages, manifest), messages);
  assert.equal(
    validatePublishedMessages({ "Sign in": messages["Sign in"] }, manifest),
    null,
  );
  assert.equal(
    validatePublishedMessages(
      { ...messages, "Injected label": "value" },
      manifest,
    ),
    null,
  );
  assert.equal(
    validatePublishedMessages({ ...messages, Retry: "" }, manifest),
    null,
  );
});
