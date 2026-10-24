import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createResumePdf } from "../src/server/resume.ts";

const profile = {
  name: "Anu",
  location: "Kochi",
  targetRole: "Shop assistant",
  language: "Malayalam",
  experience: "I helped customers and maintained shop stock.",
  skills: "Customer service, stock management",
  availability: "Weekdays",
};

test("resume exports embed each selected script's font", async () => {
  for (const [locale, experience, expectedFont] of [
    ["en", profile.experience, "NotoSansMalayalam"],
    ["ml", "ഞാൻ കടയിൽ ഉപഭോക്താക്കളെ സഹായിച്ചു.", "NotoSansMalayalam"],
    ["ta", "நான் கடையில் வாடிக்கையாளர்களுக்கு உதவினேன்.", "NotoSansTamil"],
    ["hi", "मैंने दुकान में ग्राहकों की सहायता की।", "NotoSansDevanagari"],
    ["te", "నేను దుకాణంలో వినియోగదారులకు సహాయం చేశాను.", "NotoSansTelugu"],
  ]) {
    const pdf = await createResumePdf({ ...profile, experience }, locale);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.subarray(-30).includes(Buffer.from("%%EOF")));
    assert.ok(
      pdf.includes(Buffer.from(expectedFont)),
      `${locale}: expected embedded font`,
    );
    assert.ok(
      pdf.includes(Buffer.from("/ToUnicode")),
      `${locale}: searchable Unicode text`,
    );
  }
});

test("one answer can contain all five scripts and span pages", async () => {
  const experience =
    "English stock management. മലയാളം ഉപഭോക്തൃ സേവനം. தமிழ் வாடிக்கையாளர் சேவை. हिन्दी ग्राहक सेवा। తెలుగు వినియోగదారుల సేవ.\n".repeat(
      35,
    );
  const pdf = await createResumePdf({ ...profile, experience }, "ml");
  for (const font of [
    "NotoSansMalayalam",
    "NotoSansTamil",
    "NotoSansDevanagari",
    "NotoSansTelugu",
  ])
    assert.ok(pdf.includes(Buffer.from(font)), `mixed answer embeds ${font}`);
  assert.match(pdf.toString("latin1"), /\/Count [2-9]\d*/);
  if (process.env.JOBSATHI_PDF_QA_DIR) {
    await mkdir(process.env.JOBSATHI_PDF_QA_DIR, { recursive: true });
    await writeFile(
      join(process.env.JOBSATHI_PDF_QA_DIR, "multilingual-resume.pdf"),
      pdf,
    );
  }
});
