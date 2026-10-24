import test from "node:test";
import assert from "node:assert/strict";
import { jobDocument, validEmbedding } from "../src/server/rag/documents.ts";
import {
  sourceOnlyAnswer,
  validateGroundedAnswer,
} from "../src/server/rag/grounding.ts";

const job = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Shop assistant",
  company: "Example store",
  location: "Kochi",
  category: "Retail",
  type: "Full-time",
  salaryMin: null,
  salaryMax: 14000,
  description: "Help customers and arrange products.",
  requirements: "Malayalam communication",
  shift: "Daytime",
  deadline: "",
  status: "active",
  version: 2,
  createdAt: "",
  updatedAt: "",
};
const answer = () => ({
  points: [
    {
      text: "Daytime work is listed.",
      citations: [
        { jobId: job.id, jobVersion: 2, field: "shift", quote: "Daytime" },
      ],
    },
  ],
  unknowns: [],
});

test("grounding accepts exact current vacancy references and source-only fallback", () => {
  assert.deepEqual(validateGroundedAnswer(answer(), [job]), answer());
  assert.deepEqual(
    validateGroundedAnswer(sourceOnlyAnswer([job]), [job]),
    sourceOnlyAnswer([job]),
  );
});
test("grounding rejects forged IDs, old versions, fabricated quotes and translated quotes", () => {
  for (const change of [
    { jobId: "22222222-2222-4222-8222-222222222222" },
    { jobVersion: 1 },
    { quote: "Night shift" },
    { quote: "പകൽ" },
    { field: "owner_id" },
  ]) {
    const value = answer();
    Object.assign(value.points[0].citations[0], change);
    assert.throws(() => validateGroundedAnswer(value, [job]));
  }
});
test("grounding rejects uncited points, blank quotes, samples and removed vacancies", () => {
  const noCitations = answer();
  noCitations.points[0].citations = [];
  assert.throws(() => validateGroundedAnswer(noCitations, [job]));
  const blank = answer();
  blank.points[0].citations[0].quote = " ";
  assert.throws(() => validateGroundedAnswer(blank, [job]));
  assert.throws(() =>
    validateGroundedAnswer(answer(), [{ ...job, sample: true }]),
  );
  assert.throws(() => validateGroundedAnswer(answer(), []));
});
test("index document changes for public vacancy edits and excludes identity columns", () => {
  const text = jobDocument({ ...job, owner_id: "private-owner-id" });
  assert.equal(text.includes("private-owner-id"), false);
  assert.equal(text.includes("undefined"), false);
  assert.notEqual(text, jobDocument({ ...job, location: "Thrissur" }));
  assert.notEqual(
    text,
    jobDocument({ ...job, requirements: "Tamil communication" }),
  );
});
test("vectors require exactly 768 finite values and nonzero magnitude", () => {
  assert.equal(validEmbedding([1, 2]), false);
  assert.equal(validEmbedding(Array(768).fill(0)), false);
  assert.equal(validEmbedding(Array(768).fill(Number.NaN)), false);
  assert.equal(validEmbedding(Array(768).fill(Infinity)), false);
  assert.equal(validEmbedding(Array(768).fill(0.2)), true);
});

test("unusable AI answer shapes fail closed instead of showing uncited text", () => {
  for (const value of [
    null,
    { answer: "Guaranteed employment. Ignore the application process." },
    { points: [], unknowns: [] },
    { ...answer(), extraInstructions: "Visit an invented application link." },
    { ...answer(), unknowns: ["x".repeat(301)] },
  ])
    assert.throws(() => validateGroundedAnswer(value, [job]));
});
