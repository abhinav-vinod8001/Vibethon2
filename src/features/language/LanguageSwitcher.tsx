"use client";

import { Globe2 } from "lucide-react";
import { isLocale } from "@/i18n/languages";
import { useLanguage } from "./LanguageProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t, languages } = useLanguage();
  return (
    <label className="language-switcher">
      <Globe2 size={15} aria-hidden="true" />
      <span className="sr-only">{t("Change language")}</span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {languages.map((language) => (
          <option
            key={language.code}
            value={language.code}
            lang={language.code}
          >
            {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
