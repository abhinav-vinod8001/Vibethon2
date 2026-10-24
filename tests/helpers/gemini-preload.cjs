// Test subprocess only. Production application source never imports this file.
// NODE_OPTIONS --require loads CommonJS before Next patches global.fetch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { appendFileSync } = require("node:fs");
const originalFetch = global.fetch;
global.fetch = async function testGeminiFetch(input, init) {
  const url = new URL(
    typeof input === "string" ? input : input.url || String(input),
  );
  if (url.hostname !== "generativelanguage.googleapis.com")
    return originalFetch(input, init);
  const operation = url.pathname.match(
    /^\/v1beta\/models\/[^/]+:(generateContent|embedContent)$/,
  )?.[1];
  if (!operation || init?.method !== "POST")
    throw new Error("Unexpected Google provider call in test.");
  const body = JSON.parse(init.body);
  const data =
    operation === "generateContent"
      ? JSON.parse(body.contents[0].parts[0].text)
      : null;
  appendFileSync(
    process.env.JOBSATHI_MOCK_TRACE,
    JSON.stringify({
      operation,
      kind: data?.labels
        ? "translation"
        : data?.vacancies
          ? "rag"
          : "embedding",
    }) + "\n",
  );
  if (operation === "embedContent")
    return Response.json({ embedding: { values: [1, ...Array(767).fill(0)] } });
  let answer;
  if (data.labels) {
    answer = Object.fromEntries(
      Object.entries(data.labels).map(([id, source]) => [id, `ML ${source}`]),
    );
  } else if (data.vacancies?.length) {
    const vacancy = data.vacancies[0];
    answer = {
      points: [
        {
          text: "This vacancy includes customer service work.",
          citations: [
            {
              jobId: vacancy.jobId,
              jobVersion: vacancy.jobVersion,
              field: "description",
              quote: data.question.includes("[invalid-citation]")
                ? "Invented source quote not present in this vacancy."
                : vacancy.fields.description,
            },
          ],
        },
      ],
      unknowns: [],
    };
  } else throw new Error("Unexpected generation payload in test.");
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }],
  });
};
