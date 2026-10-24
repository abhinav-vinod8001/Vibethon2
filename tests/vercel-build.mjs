import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Next 16.3 suppresses the whole-server NFT when an adapter is present, while
// standalone packaging still tries to read it. A plain local build misses this.
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_ADAPTER_PATH: fileURLToPath(
        new URL("./fixtures/build-adapter.mjs", import.meta.url),
      ),
    },
    windowsHide: true,
    stdio: "inherit",
  },
);
const [code] = await once(build, "exit");
assert.equal(code, 0, "The Vercel-mode adapter build must succeed.");
const manifest = JSON.parse(
  await readFile(".next/required-server-files.json", "utf8"),
);
assert.equal(
  manifest.config.output,
  undefined,
  "Vercel must use adapter output rather than standalone packaging.",
);
const tracePath = resolve(
  ".next/server/app/api/profile/resume/route.js.nft.json",
);
const trace = JSON.parse(await readFile(tracePath, "utf8"));
assert.ok(
  trace.files.some((file) => basename(file).endsWith(".ttf")),
  "PDF font must remain traced in adapter builds.",
);
console.log(
  "PASS: Vercel-mode adapter build, default output, and traced PDF font.",
);
