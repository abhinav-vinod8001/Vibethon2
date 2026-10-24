"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LANGUAGES,
  isLocale,
  LANGUAGE_COOKIE,
  type Locale,
} from "@/i18n/languages";
import type { LanguageChoice, TranslationBundle } from "@/i18n/catalog";
import { translate } from "@/i18n/translate";

type LanguageContextValue = {
  locale: Locale;
  selected: boolean;
  setLocale: (locale: Locale) => void;
  t: (source: string) => string;
  languages: LanguageChoice[];
  translationStatus: "loading" | "cache" | "source" | "fallback";
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale | null;
  children: ReactNode;
}) {
  const [choice, setChoice] = useState<Locale | null>(initialLocale);
  const [languages, setLanguages] = useState<LanguageChoice[]>(() =>
    LANGUAGES.map((language) => ({ ...language, pdfSupported: true })),
  );
  const [remote, setRemote] = useState<{
    locale: Locale;
    messages: Record<string, string>;
    status: LanguageContextValue["translationStatus"];
  }>({ locale: initialLocale || "en", messages: {}, status: "fallback" });
  const attempted = useRef(new Set<string>());
  const locale = choice || "en";
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    document.documentElement.lang = next;
    document.title = `JobSathi — ${translate("Find work. Share your experience.", next)}`;
    setChoice(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/languages", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { source?: unknown; languages?: unknown } | null) => {
        if (controller.signal.aborted || !Array.isArray(result?.languages))
          return;
        const registered = result.languages.filter(
          (item): item is LanguageChoice =>
            Boolean(
              item &&
                isLocale(item.code) &&
                typeof item.name === "string" &&
                typeof item.nativeName === "string" &&
                typeof item.speechCode === "string" &&
                typeof item.pdfSupported === "boolean",
            ),
        );
        setLanguages(registered);
        if (result?.source === "database") {
          setChoice((current) => {
            if (!current || registered.some((item) => item.code === current))
              return current;
            document.cookie = `${LANGUAGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
            document.documentElement.lang = "en";
            return null;
          });
        }
      })
      .catch(() => {
        /* Offline registration uses the existing supported grid. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const bundles: TranslationBundle[] = ["entry", "workspace", "resume"];
    type BundleResponse = {
      locale: Locale;
      bundle: TranslationBundle;
      messages: Record<string, string>;
      version: string;
      source: "cache" | "source" | "fallback";
      canGenerate: boolean;
    };
    async function load(bundle: TranslationBundle, method = "GET") {
      const response = await fetch(
        `/api/translations?locale=${locale}&bundle=${bundle}`,
        {
          method,
          signal: controller.signal,
        },
      );
      if (!response.ok) return null;
      const result = (await response.json()) as BundleResponse;
      if (
        controller.signal.aborted ||
        result.locale !== locale ||
        result.bundle !== bundle ||
        !result.messages ||
        typeof result.messages !== "object" ||
        Object.values(result.messages).some(
          (value) => typeof value !== "string",
        )
      )
        return null;
      return result;
    }
    async function refresh() {
      const results = await Promise.all(
        bundles.map((bundle) => load(bundle).catch(() => null)),
      );
      if (controller.signal.aborted) return;
      const available = results.filter(
        (result): result is BundleResponse => result !== null,
      );
      const messages = Object.assign(
        {},
        ...available.map((result) => result.messages),
      );
      setRemote({
        locale,
        messages,
        status:
          locale === "en"
            ? "source"
            : available.length === bundles.length &&
                available.every((item) => item.source === "cache")
              ? "cache"
              : "fallback",
      });
      // GET never spends quota. Generate only approved missing bundles once per
      // cache version in this page, sequentially, behind the server's daily cap.
      for (const result of available) {
        if (controller.signal.aborted) return;
        if (
          result.source !== "fallback" ||
          !result.canGenerate ||
          attempted.current.has(result.version)
        )
          continue;
        attempted.current.add(result.version);
        const generated = await load(result.bundle, "POST").catch(() => null);
        if (controller.signal.aborted) return;
        if (generated?.source === "cache") {
          Object.assign(messages, generated.messages);
          result.source = "cache";
          setRemote({
            locale,
            messages: { ...messages },
            status:
              available.length === bundles.length &&
              available.every((item) => item.source === "cache")
                ? "cache"
                : "fallback",
          });
        }
      }
    }
    void refresh();
    return () => controller.abort();
  }, [locale]);

  const t = useCallback(
    (source: string) =>
      (remote.locale === locale ? remote.messages[source] : undefined) ||
      translate(source, locale),
    [locale, remote],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `JobSathi — ${t("Find work. Share your experience.")}`;
  }, [locale, t]);
  const value = useMemo(
    () => ({
      locale,
      selected: choice !== null,
      setLocale,
      t,
      languages,
      translationStatus:
        remote.locale === locale ? remote.status : ("loading" as const),
    }),
    [locale, choice, setLocale, t, languages, remote],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required.");
  return context;
}
