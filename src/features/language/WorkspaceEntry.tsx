"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Handshake,
  Loader2,
  UserRound,
} from "lucide-react";
import { LANGUAGES } from "@/i18n/languages";
import JobSathi from "@/features/workspace/JobSathiWorkspace";
import { api } from "@/features/workspace/api";
import { useBootstrap } from "@/features/workspace/useBootstrap";
import { useLanguage } from "./LanguageProvider";
import { ROLE_COOKIE, type EntryRole } from "./role";

export function WorkspaceEntry({
  initialRole,
}: {
  initialRole: EntryRole | null;
}) {
  const { locale, selected, setLocale, t, languages } = useLanguage();
  const { data, loading, error, setError, reload } = useBootstrap();
  const [browsing, setBrowsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"language" | "role" | "login">("language");
  const [role, setRole] = useState<EntryRole | null>(initialRole);
  const choosingLanguage = stage === "language";
  const language =
    languages.find((item) => item.code === locale) || LANGUAGES[0];

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/auth/sign-in", {
        method: "POST",
      });
      window.location.assign(result.url);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  if (selected && (data?.user || browsing))
    return <JobSathi initialRole={role || "candidate"} />;

  function chooseRole(next: EntryRole) {
    setRole(next);
    document.cookie = `${ROLE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    setStage("login");
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-topbar">
        <Link className="onboarding-brand" href="/" aria-label="JobSathi">
          <span className="brand-symbol">
            <Handshake aria-hidden="true" />
          </span>
          <span>
            Job<span className="brand-green">Sathi</span>
          </span>
        </Link>
        <span className="entry-step" aria-hidden="true">
          <span className={choosingLanguage ? "current" : "complete"} />{" "}
          <span
            className={
              stage === "role" ? "current" : stage === "login" ? "complete" : ""
            }
          />
          <span className={stage === "login" ? "current" : ""} />
        </span>
      </div>
      <div className="entry-frame">
        <aside className="entry-showcase" aria-hidden="true">
          <div className="entry-showcase-mark">
            <Handshake size={29} />
          </div>
          <div className="entry-showcase-copy">
            <span className="entry-showcase-eyebrow">JOBSATHI</span>
            <h2>{t("Your experience. Your next opportunity.")}</h2>
            <p>{t("Find work. Share your experience.")}</p>
          </div>
          <span className="entry-showcase-orbit" />
        </aside>
        <section
          key={stage}
          className={`onboarding-card ${choosingLanguage ? "language-card" : "login-card"}`}
          aria-labelledby="onboarding-title"
        >
          {choosingLanguage ? (
            <>
              <div className="entry-heading">
                <h1 id="onboarding-title">{t("Choose your language")}</h1>
                <p>
                  {t(
                    "Choose a language to get started. You can change it at any time.",
                  )}
                </p>
              </div>
              <div className="language-options">
                {languages.map((language) => (
                  <button
                    key={language.code}
                    className={`language-option ${selected && locale === language.code ? "selected" : ""}`}
                    lang={language.code}
                    onClick={() => {
                      setLocale(language.code);
                      setError("");
                      setStage("role");
                    }}
                  >
                    {selected && locale === language.code && (
                      <Check
                        size={15}
                        className="language-check"
                        aria-hidden="true"
                      />
                    )}
                    <strong>{language.nativeName}</strong>
                    <small lang="en">
                      {language.nativeName === language.name
                        ? "EN"
                        : language.name}
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="entry-back"
                onClick={() => {
                  setStage(stage === "login" ? "role" : "language");
                  setError("");
                }}
                aria-label={t(
                  stage === "login"
                    ? "Choose how you want to continue"
                    : "Change language",
                )}
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span lang={locale}>
                  {stage === "login"
                    ? t("Choose how you want to continue")
                    : language.nativeName}
                </span>
              </button>
              {stage === "role" ? (
                <>
                  <div className="entry-heading">
                    <h1 id="onboarding-title">{t("Welcome to JobSathi")}</h1>
                    <p>{t("Choose how you want to continue")}</p>
                  </div>
                  <div
                    className="entry-roles"
                    role="group"
                    aria-label={t("Choose how you want to continue")}
                  >
                    <button
                      type="button"
                      className={`entry-role ${role === "candidate" ? "selected" : ""}`}
                      onClick={() => chooseRole("candidate")}
                    >
                      <span className="entry-role-icon">
                        <UserRound size={21} aria-hidden="true" />
                      </span>
                      <span className="entry-role-copy">
                        <strong>{t("Employee")}</strong>
                        <small>{t("Find jobs")}</small>
                      </span>
                      <ArrowRight
                        className="entry-role-arrow"
                        size={18}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className={`entry-role ${role === "employer" ? "selected" : ""}`}
                      onClick={() => chooseRole("employer")}
                    >
                      <span className="entry-role-icon">
                        <BriefcaseBusiness size={21} aria-hidden="true" />
                      </span>
                      <span className="entry-role-copy">
                        <strong>{t("Employer")}</strong>
                        <small>{t("Post a job")}</small>
                      </span>
                      <ArrowRight
                        className="entry-role-arrow"
                        size={18}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="entry-heading">
                    <h1 id="onboarding-title">
                      {t(role === "employer" ? "Employer" : "Employee")}
                    </h1>
                    <p>{t(role === "employer" ? "Post a job" : "Find jobs")}</p>
                  </div>
                  {loading ? (
                    <p className="onboarding-loading" role="status">
                      <Loader2 className="spin" />
                      {t("Checking your sign-in…")}
                    </p>
                  ) : (
                    <div className="onboarding-actions">
                      <button
                        className="button primary"
                        onClick={() => void signIn()}
                        disabled={busy || !role || !data?.auth.configured}
                      >
                        {busy ? (
                          <Loader2 className="spin" size={18} />
                        ) : (
                          <svg
                            className="google-mark"
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="#4285F4"
                              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59A6 6 0 0 1 12 5.95Z"
                            />
                          </svg>
                        )}
                        {t(busy ? "Opening Google…" : "Continue with Google")}
                      </button>
                      {!data?.auth.configured && !error && (
                        <p className="info-note">
                          {t(
                            "Sign-in is not available yet. You can browse jobs while it is being configured.",
                          )}
                        </p>
                      )}
                      <button
                        className="entry-browse"
                        onClick={() => setBrowsing(true)}
                      >
                        {t("Browse jobs first")} <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  {error && (
                    <div className="alert error" role="alert">
                      {t(error)}{" "}
                      <button type="button" onClick={() => void reload()}>
                        {t("Retry")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
