import { commonDictionary } from "./dictionaries/common.ts";
import { onboardingDictionary } from "./dictionaries/onboarding.ts";
import { workspaceDictionary } from "./dictionaries/workspace.ts";
import type { Locale } from "./languages";
import { RAG_SOURCE_TEXT } from "./rag-sources.ts";

export type LanguageChoice = {
  code: Locale;
  name: string;
  nativeName: string;
  speechCode: string;
  pdfSupported: boolean;
};

/** Approved UI text only. Callers cannot submit arbitrary text to the provider. */
const entrySources = [
  "Choose your language",
  "Choose a language to get started. You can change it at any time.",
  "Change language",
  "Welcome to JobSathi",
  "Find work. Share your experience.",
  "Sign in",
  "Sign in to save your resume, apply for jobs, or hire people.",
  "Continue with Google",
  "Browse jobs first",
  "Checking your sign-in…",
  "Opening Google…",
  "Your language choice will be remembered on this device.",
  "Sign-in is not available yet. You can browse jobs while it is being configured.",
  "Retry",
] as const;
const entry = new Set<string>(entrySources);
const resume = new Set(Object.keys(onboardingDictionary));
export const TRANSLATION_BUNDLES = ["entry", "workspace", "resume"] as const;
export type TranslationBundle = (typeof TRANSLATION_BUNDLES)[number];
export const TRANSLATION_PROMPT_VERSION = "ui-v1";

const bundleSources: Record<TranslationBundle, readonly string[]> = {
  entry: [...entry].sort(),
  workspace: [
    ...new Set([
      ...Object.keys(workspaceDictionary),
      ...Object.keys(commonDictionary),
      ...RAG_SOURCE_TEXT,
    ]),
  ]
    .filter((source) => !entry.has(source) && !resume.has(source))
    .sort(),
  resume: [...resume].filter((source) => !entry.has(source)).sort(),
};

export function isTranslationBundle(
  value: unknown,
): value is TranslationBundle {
  return TRANSLATION_BUNDLES.some((bundle) => bundle === value);
}

export function translationSources(
  bundle: TranslationBundle,
): readonly string[] {
  return bundleSources[bundle];
}

/** Small stable IDs keep repeated response schemas and generated output bounded. */
export function sourceId(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `s${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function translationManifest(bundle: TranslationBundle) {
  const manifest: Record<string, string> = {};
  for (const source of translationSources(bundle)) {
    const id = sourceId(source);
    if (Object.hasOwn(manifest, id))
      throw new Error("Translation ID collision.");
    manifest[id] = source;
  }
  return manifest;
}
