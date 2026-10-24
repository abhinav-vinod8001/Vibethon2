"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/features/language/LanguageProvider";
import { requestError } from "@/i18n/translate";

export function ResumeDownload() {
  const { locale, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/profile/resume?locale=${locale}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(requestError(result.error, response.status));
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "jobsathi-resume.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="resume-export">
      <div>
        <h3>{t("Your resume, ready to share")}</h3>
        <p>
          {t("Download the saved profile shown above. Save any edits first.")}
        </p>
      </div>
      <button
        className="button secondary"
        onClick={() => void download()}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
        {busy ? t("Preparing PDF…") : t("Download resume PDF")}
      </button>
      {error && (
        <p className="alert error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
