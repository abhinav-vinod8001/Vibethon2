import { commonDictionary } from "./dictionaries/common";
import { workspaceDictionary } from "./dictionaries/workspace";
import { onboardingDictionary } from "./dictionaries/onboarding";
import { type Dictionary, type Locale } from "./languages";

const dictionary: Dictionary = {
  ...workspaceDictionary,
  ...onboardingDictionary,
  ...commonDictionary,
};
const positions = { ml: 0, ta: 1, hi: 2, te: 3 } as const;

/** Offline fallback only; the client prefers versioned API translation bundles. */
export function translate(source: string, locale: Locale): string {
  if (locale === "en") return source;
  return dictionary[source]?.[positions[locale]] || source;
}

/** Translate known server messages; keep unreviewed provider details out of UI. */
export function requestError(
  source: string | undefined,
  status: number,
): string {
  if (source && dictionary[source]) return source;
  const fallback =
    status === 401
      ? "Please sign in again to continue."
      : status === 403
        ? "You cannot access or change this record."
        : status === 404
          ? "This item is no longer available. Refresh and try again."
          : status === 409
            ? "This vacancy or application changed. Refresh before trying again."
            : status === 400 || status === 413 || status === 422
              ? "Please check the supplied fields and try again."
              : "The request could not be completed. Please try again.";
  return fallback;
}
