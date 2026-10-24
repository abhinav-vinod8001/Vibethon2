export type Locale = "en" | "ml" | "ta" | "hi" | "te";
export type Dictionary = Record<
  string,
  readonly [string, string, string, string]
>;

export const LANGUAGE_COOKIE = "jobsathi_locale";
export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", speechCode: "en-IN" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", speechCode: "ml-IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", speechCode: "ta-IN" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", speechCode: "hi-IN" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", speechCode: "te-IN" },
] as const satisfies ReadonlyArray<{
  code: Locale;
  name: string;
  nativeName: string;
  speechCode: string;
}>;

export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some((language) => language.code === value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : "en";
}

export function browserLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split("=")[1];
  return resolveLocale(value);
}
