import { isTranslationBundle } from "@/i18n/catalog";
import { isLocale } from "@/i18n/languages";
import { body, checkOrigin, HttpError, json, route } from "@/server/http";
import { translationBundle } from "@/server/translations";

export const runtime = "nodejs";
export const maxDuration = 120;

function parameters(value: { locale?: unknown; bundle?: unknown }) {
  if (!isLocale(value.locale) || !isTranslationBundle(value.bundle))
    throw new HttpError(400, "Choose a supported language.");
  return { locale: value.locale, bundle: value.bundle };
}

export async function GET(request: Request) {
  return route(async () => {
    const query = new URL(request.url).searchParams;
    const { locale, bundle } = parameters({
      locale: query.get("locale"),
      bundle: query.get("bundle"),
    });
    return json(await translationBundle(locale, bundle));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const query = new URL(request.url).searchParams;
    const supplied = request.headers
      .get("content-type")
      ?.includes("application/json")
      ? await body(request)
      : { locale: query.get("locale"), bundle: query.get("bundle") };
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied))
      throw new HttpError(400, "Choose a supported language.");
    const { locale, bundle } = parameters(supplied);
    return json(await translationBundle(locale, bundle, true));
  });
}
