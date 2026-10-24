import { cookies } from "next/headers";
import {
  isLocale,
  LANGUAGES,
  resolveLocale,
  type Locale,
} from "@/i18n/languages";
import { HttpError } from "@/server/errors";

/** The interface preference is separate from the language saved in a profile. */
export async function requestLocale(value?: unknown): Promise<Locale> {
  if (value !== undefined && value !== null) {
    if (!isLocale(value))
      throw new HttpError(400, "Choose a supported language.");
    return value;
  }
  return resolveLocale((await cookies()).get("jobsathi_locale")?.value);
}

export function languageName(locale: Locale): string {
  return LANGUAGES.find((language) => language.code === locale)!.name;
}

/** Accept the existing language names and the new locale / BCP-47 codes. */
export function speechLanguage(value: unknown, fallback: Locale): string {
  if (value === null || value === undefined || value === "") {
    return LANGUAGES.find((language) => language.code === fallback)!.speechCode;
  }
  const language = LANGUAGES.find(
    (language) =>
      value === language.code ||
      value === language.name ||
      value === language.speechCode,
  );
  if (!language)
    throw new HttpError(400, "Choose a supported recording language.");
  return language.speechCode;
}
