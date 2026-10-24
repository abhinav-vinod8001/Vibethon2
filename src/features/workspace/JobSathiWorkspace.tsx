"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Handshake,
  Layers3,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api } from "./api";
import { useBootstrap } from "./useBootstrap";
import type { Explanation, JobDraft, RagAnswer } from "./types";
import { RagSearchAnswer } from "./RagSearchAnswer";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { ResumeDownload } from "./ResumeDownload";
import { ResumeWizard } from "@/features/resume/ResumeWizard";
import { useLanguage } from "@/features/language/LanguageProvider";
import { LanguageSwitcher } from "@/features/language/LanguageSwitcher";
import { type EntryRole } from "@/features/language/role";
import { CATEGORIES, type Application, type Job } from "@/domain/types";
import { filterJobs, keywordScore } from "@/domain/matching";

const EMPTY_JOB: JobDraft = {
  title: "",
  company: "",
  location: "Kothamangalam",
  category: "Retail",
  type: "Full-time",
  salaryMin: "",
  salaryMax: "",
  description: "",
  requirements: "",
  shift: "",
  deadline: "",
};
function salary(job: Job, t: (source: string) => string, locale: string) {
  const money = (value: number) =>
    new Intl.NumberFormat(`${locale}-IN`).format(value);
  return job.salaryMin !== null && job.salaryMax !== null
    ? `₹${money(job.salaryMin)}–${money(job.salaryMax)}`
    : job.salaryMin !== null
      ? t("From ₹{amount}").replace("{amount}", money(job.salaryMin))
      : job.salaryMax !== null
        ? t("Up to ₹{amount}").replace("{amount}", money(job.salaryMax))
        : t("Pay not specified");
}
const categoryIcon = (category: string) =>
  category === "Delivery" ? (
    <ArrowUpRight />
  ) : category === "Office & admin" ? (
    <Layers3 />
  ) : category === "Customer support" ? (
    <Users />
  ) : (
    <Building2 />
  );

export default function JobSathi({
  initialRole = "candidate",
}: {
  initialRole?: EntryRole;
}) {
  const { locale, t } = useLanguage();
  const searchRequest = useRef<AbortController | null>(null);
  const jobTranslationRequest = useRef<AbortController | null>(null);
  const [jobTranslation, setJobTranslation] = useState<{
    locale: string;
    jobId: string;
    version: number;
    title: string;
    description: string;
    requirements: string;
  } | null>(null);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [searchAnswer, setSearchAnswer] = useState<{
    locale: string;
    answer: RagAnswer;
  } | null>(null);
  useEffect(() => () => searchRequest.current?.abort(), [locale]);
  useEffect(() => () => jobTranslationRequest.current?.abort(), [locale]);
  const [explanationLocale, setExplanationLocale] = useState(locale);
  const [applicantSummaryLocale, setApplicantSummaryLocale] = useState(locale);
  const [summaryApplicationId, setSummaryApplicationId] = useState("");
  const { data, loading, error, setError, reload: load } = useBootstrap();
  const [toast, setToast] = useState<{
    source: string;
    status?: string;
  } | null>(null);
  const workspace = initialRole;
  const [view, setView] = useState(
      initialRole === "employer" ? "overview" : "discover",
    ),
    [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [category, setCategory] = useState(""),
    [type, setType] = useState("");
  const [includeSamples, setIncludeSamples] = useState(true),
    [matched, setMatched] = useState<Job[] | null>(null),
    [searchMode, setSearchMode] = useState("browse"),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(""),
    [selected, setSelected] = useState<Job | null>(null),
    [explanation, setExplanation] = useState<Explanation | null>(null),
    [question, setQuestion] = useState(""),
    [detailError, setDetailError] = useState(""),
    [consent, setConsent] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false),
    [jobDraft, setJobDraft] = useState<JobDraft>(EMPTY_JOB),
    [postError, setPostError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false),
    [activeApplicant, setActiveApplicant] = useState<Application | null>(null),
    [applicantSummary, setApplicantSummary] = useState<Explanation | null>(
      null,
    );
  async function signIn() {
    setBusy("auth");
    try {
      const { url } = await api<{ url: string }>("/api/auth/sign-in", {
        method: "POST",
      });
      window.location.assign(url);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function signOut() {
    setBusy("auth");
    try {
      await api("/api/auth/sign-out", { method: "POST" });
      window.location.reload();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  const invalidateSearch = () => {
    searchRequest.current?.abort();
    searchRequest.current = null;
    setBusy((current) => (current === "search" ? "" : current));
    setSearchAnswer(null);
    setMatched(null);
    setNotice("");
    setSearchMode("browse");
  };
  const openProfile = () => {
    if (!data?.user) {
      void signIn();
      return;
    }
    setProfileOpen(true);
  };
  const navigate = (next: string) => {
    setView(next);
    setSelected(null);
  };
  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchAnswer(null);
    setBusy("search");
    setError("");
    try {
      if (!data?.user) {
        const jobs = filterJobs(data?.jobs || [], {
          location,
          category,
          type,
          includeSamples,
        });
        setMatched(
          query
            ? jobs
                .filter((j) => keywordScore(query, j) > 0)
                .sort((a, b) => keywordScore(query, b) - keywordScore(query, a))
            : jobs,
        );
        setSearchMode("keyword");
        setNotice("Keyword results. Sign in to use your profile for matching.");
      } else {
        let result: { jobs: Job[]; mode: string; notice: string };
        if (query.trim()) {
          const answer = await api<RagAnswer>("/api/rag", {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
              question: query,
              locale,
              location,
              category,
              type,
            }),
          });
          if (controller.signal.aborted) return;
          setSearchAnswer({ locale, answer });
          result = answer;
        } else {
          result = await api<{ jobs: Job[]; mode: string; notice: string }>(
            "/api/match",
            {
              method: "POST",
              signal: controller.signal,
              body: JSON.stringify({
                query,
                location,
                category,
                type,
                includeSamples,
              }),
            },
          );
        }
        if (controller.signal.aborted) return;
        setMatched(result.jobs);
        setSearchMode(
          result.mode === "rag" || result.mode === "retrieval"
            ? "semantic"
            : result.mode,
        );
        setNotice(result.notice);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (searchRequest.current === controller)
        setBusy((current) => (current === "search" ? "" : current));
    }
  };
  const showJob = (job: Job) => {
    jobTranslationRequest.current?.abort();
    setTranslationBusy(false);
    setJobTranslation(null);
    setSelected(job);
    setExplanation(null);
    setDetailError("");
    setConsent(false);
    setQuestion("");
    if (locale !== "en") void translateJob(job);
  };
  const translateJob = async (requestedJob: Job | null = selected) => {
    if (!requestedJob || locale === "en") return;
    jobTranslationRequest.current?.abort();
    const controller = new AbortController();
    jobTranslationRequest.current = controller;
    const job = requestedJob;
    const requestLocale = locale;
    setTranslationBusy(true);
    try {
      const result = await api<{
        title: string;
        description: string;
        requirements: string;
        translated: boolean;
      }>("/api/jobs/translate", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ jobId: job.id, locale: requestLocale }),
      });
      if (!controller.signal.aborted && result.translated)
        setJobTranslation({
          ...result,
          locale: requestLocale,
          jobId: job.id,
          version: job.version,
        });
    } catch {
      // Original employer wording remains visible if translation fails.
    } finally {
      if (jobTranslationRequest.current === controller)
        setTranslationBusy(false);
    }
  };
  const explain = async () => {
    if (!selected) return;
    const requestLocale = locale;
    setBusy("explain");
    setDetailError("");
    try {
      setExplanation(
        await api<Explanation>("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "explain",
            locale,
            jobId: selected.id,
            question,
          }),
        }),
      );
      setExplanationLocale(requestLocale);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const apply = async () => {
    if (!selected) return;
    setBusy("apply");
    setDetailError("");
    try {
      await api("/api/applications", {
        method: "POST",
        body: JSON.stringify({
          jobId: selected.id,
          version: selected.version,
          confirmed: consent,
        }),
      });
      await load();
      setSelected(null);
      setToast({
        source: "Application submitted. You can track it in My applications.",
      });
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const postJob = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("post");
    setPostError("");
    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...jobDraft,
          salaryMin: jobDraft.salaryMin ? Number(jobDraft.salaryMin) : null,
          salaryMax: jobDraft.salaryMax ? Number(jobDraft.salaryMax) : null,
        }),
      });
      await load();
      setPostOpen(false);
      setJobDraft(EMPTY_JOB);
      invalidateSearch();
      setToast({
        source: "Vacancy published. It is now available in job discovery.",
      });
    } catch (e) {
      setPostError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const toggleJob = async (job: Job) => {
    setBusy(job.id);
    try {
      await api("/api/jobs", {
        method: "PATCH",
        body: JSON.stringify({
          id: job.id,
          status: job.status === "active" ? "closed" : "active",
        }),
      });
      await load();
      invalidateSearch();
      setToast({
        source:
          job.status === "active"
            ? "Vacancy closed. New applications are blocked."
            : "Vacancy reopened.",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const updateApplication = async (id: string, status: string) => {
    setBusy(id);
    try {
      await api("/api/applications", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      await load();
      setActiveApplicant(null);
      setToast({ source: "Application updated:", status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const summarize = async () => {
    if (!activeApplicant) return;
    const requestLocale = locale;
    const requestApplicationId = activeApplicant.id;
    setBusy("summary");
    setDetailError("");
    try {
      setApplicantSummary(
        await api<Explanation>("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "applicant",
            locale,
            jobId: activeApplicant.jobId,
            applicationId: activeApplicant.id,
          }),
        }),
      );
      setApplicantSummaryLocale(requestLocale);
      setSummaryApplicationId(requestApplicationId);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const listed =
    matched ||
    filterJobs(data?.jobs || [], { location, category, type, includeSamples });
  const appliedIds = new Set(data?.applications.map((a) => a.jobId));
  const profile = data?.profile;
  const completed = profile ? Object.values(profile).filter(Boolean).length : 0;
  const shownTranslation =
    selected &&
    jobTranslation?.locale === locale &&
    jobTranslation.jobId === selected.id &&
    jobTranslation.version === selected.version
      ? jobTranslation
      : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => {
            navigate(workspace === "candidate" ? "discover" : "overview");
          }}
          aria-label={t("JobSathi home")}
        >
          <span className="brand-symbol">
            <Handshake size={24} />
          </span>
          <span>
            Job<span className="brand-green">Sathi</span>
            <i />
          </span>
        </button>
        <div className="workspace-label">{t("YOUR WORKSPACE")}</div>
        <nav aria-label={t("Main navigation")}>
          {workspace === "candidate" ? (
            <>
              <button
                className={view === "discover" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("discover")}
              >
                <Search />
                {t("Find opportunities")}
                <span className="nav-dot" />
              </button>
              <button
                className={
                  view === "applications" ? "nav-item active" : "nav-item"
                }
                onClick={() => navigate("applications")}
              >
                <FileCheck2 />
                {t("My applications")}
                {Boolean(data?.applications.length) && (
                  <span className="nav-count">{data?.applications.length}</span>
                )}
              </button>
              <button
                className={view === "profile" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("profile")}
              >
                <UserRound />
                {t("My resume")}
              </button>
            </>
          ) : (
            <>
              <button
                className={view === "overview" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("overview")}
              >
                <BriefcaseBusiness />
                {t("Your vacancies")}
              </button>
              <button
                className={
                  view === "applicants" ? "nav-item active" : "nav-item"
                }
                onClick={() => navigate("applicants")}
              >
                <Users />
                {t("Applications")}
                {Boolean(data?.employerApplications.length) && (
                  <span className="nav-count">
                    {data?.employerApplications.length}
                  </span>
                )}
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="note-star">✳</span>
          <h3>
            {t("A little support.")}
            <br />
            {t("A new beginning.")}
          </h3>
          <p>{t("Good work starts with being understood.")}</p>
          <button onClick={() => setHelpOpen(true)}>
            {t("How JobSathi helps")} <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <CircleHelp />
            {t("Help & how it works")}
          </button>
          <div className="made-for">
            <span />
            {t("Built for local opportunities")}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Handshake size={22} /> JobSathi
          </div>
          <div className="active-role-label">
            {t(workspace === "candidate" ? "Employee" : "Employer")}
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            {data?.user ? (
              <>
                <button
                  className="avatar"
                  aria-label={t("Open your profile")}
                  onClick={() =>
                    workspace === "candidate"
                      ? navigate("profile")
                      : navigate("overview")
                  }
                >
                  {(profile?.name || data.user.name).slice(0, 1).toUpperCase()}
                </button>
                <button
                  className="text-button"
                  onClick={() => void signOut()}
                  disabled={busy === "auth"}
                >
                  {t("Sign out")}
                </button>
              </>
            ) : (
              <button
                className="sign-in"
                disabled={busy === "auth"}
                onClick={() => void signIn()}
              >
                {t("Sign in")} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </header>
        <nav className="mobile-nav" aria-label={t("Mobile navigation")}>
          <button
            className={
              (
                workspace === "candidate"
                  ? view === "discover"
                  : view === "overview"
              )
                ? "active"
                : ""
            }
            aria-current={
              (
                workspace === "candidate"
                  ? view === "discover"
                  : view === "overview"
              )
                ? "page"
                : undefined
            }
            onClick={() =>
              navigate(workspace === "candidate" ? "discover" : "overview")
            }
          >
            <Search size={16} />{" "}
            {workspace === "candidate" ? t("Find jobs") : t("Vacancies")}
          </button>
          <button
            className={
              (
                workspace === "candidate"
                  ? view === "applications"
                  : view === "applicants"
              )
                ? "active"
                : ""
            }
            aria-current={
              (
                workspace === "candidate"
                  ? view === "applications"
                  : view === "applicants"
              )
                ? "page"
                : undefined
            }
            onClick={() =>
              navigate(
                workspace === "candidate" ? "applications" : "applicants",
              )
            }
          >
            <FileCheck2 size={16} /> {t("Applications")}
          </button>
          <button
            className={
              workspace === "candidate" && view === "profile" ? "active" : ""
            }
            aria-current={
              workspace === "candidate" && view === "profile"
                ? "page"
                : undefined
            }
            onClick={() =>
              workspace === "candidate"
                ? navigate("profile")
                : setPostOpen(true)
            }
          >
            <UserRound size={16} />
            {workspace === "candidate" ? t("My resume") : t("Post a job")}
          </button>
        </nav>
        <main className="main-content">
          {error && (
            <div className="alert error" role="alert">
              {t(error)}
              <button onClick={() => void load()}>{t("Retry")}</button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <Loader2 className="spin" />
              <h2>{t("Finding your starting point…")}</h2>
            </div>
          ) : (
            <>
              {workspace === "candidate" && view === "discover" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    {t("YOUR NEXT CHAPTER STARTS HERE")}
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <h1>
                        {locale === "en" ? (
                          <>
                            Your experience.
                            <br />
                            Your next <em>opportunity.</em>
                          </>
                        ) : (
                          t("Your experience. Your next opportunity.")
                        )}
                      </h1>
                      <p>
                        {locale === "en" ? (
                          <>
                            You bring the skills. We help you put them into
                            words
                            <br className="desktop-break" /> and find work that
                            fits.
                          </>
                        ) : (
                          t(
                            "You bring the skills. We help you put them into words and find work that fits.",
                          )
                        )}
                      </p>
                      <div className="hero-footnote">
                        <span className="tiny-avatars">
                          <i>S</i>
                          <i>A</i>
                          <i>J</i>
                        </span>
                        <span>
                          {t(
                            "For first jobs, fresh starts, and everything in between.",
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <span className="art-spark">✳</span>
                      <div className="floating-card card-one">
                        <span className="art-icon">
                          <Mic />
                        </span>
                        <div>
                          <b>{t("Your story, in your words")}</b>
                          <small>{t("Start in your language")}</small>
                        </div>
                        <span className="wave">▂▅▃▇▅▂▆▃</span>
                      </div>
                      <div className="floating-card card-two">
                        <span className="art-icon peach">
                          <BriefcaseBusiness />
                        </span>
                        <div>
                          <b>{t("A place for your potential")}</b>
                          <small>{t("Local work. Real possibilities.")}</small>
                        </div>
                        <span className="card-check">
                          <Check size={15} />
                        </span>
                      </div>
                      <span className="art-cross">+</span>
                    </div>
                  </section>

                  <form className="search-bar" onSubmit={search}>
                    <label className="search-input">
                      <Search size={20} />
                      <input
                        aria-label={t("Job title, skill or keyword")}
                        placeholder={t(
                          "Job title, skill, or something you're good at",
                        )}
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          invalidateSearch();
                        }}
                      />
                    </label>
                    <label className="location-input">
                      <MapPin size={18} />
                      <select
                        aria-label={t("Location")}
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          invalidateSearch();
                        }}
                      >
                        <option value="">{t("All locations")}</option>
                        {Array.from(
                          new Set(data?.jobs.map((j) => j.location)),
                        ).map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button primary"
                      disabled={busy === "search"}
                    >
                      {busy === "search" ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <>
                          {t("Find opportunities")} <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>

                  {searchAnswer?.locale === locale && (
                    <RagSearchAnswer
                      answer={searchAnswer.answer}
                      onViewJob={showJob}
                    />
                  )}

                  <div className="discovery-grid">
                    <section className="results">
                      <div className="section-heading">
                        <div>
                          <h2>
                            {t("Find your next step")}{" "}
                            <span>{listed.length}</span>
                          </h2>
                          <p>
                            {searchMode === "semantic"
                              ? t(
                                  "Ordered by related experience. You decide what fits.",
                                )
                              : t(
                                  "Explore roles, read the details, and make your move.",
                                )}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            setQuery("");
                            setCategory("");
                            setLocation("");
                            setType("");
                            invalidateSearch();
                          }}
                        >
                          {t("Reset filters")}
                        </button>
                      </div>
                      <div className="filter-row">
                        <div className="category-pills">
                          <button
                            className={!category ? "pill active" : "pill"}
                            onClick={() => {
                              setCategory("");
                              invalidateSearch();
                            }}
                          >
                            {t("All opportunities")}
                          </button>
                          {[
                            "Retail",
                            "Office & admin",
                            "Delivery",
                            "Hospitality",
                          ].map((c) => (
                            <button
                              key={c}
                              className={
                                category === c ? "pill active" : "pill"
                              }
                              onClick={() => {
                                setCategory(c);
                                invalidateSearch();
                              }}
                            >
                              {t(c)}
                            </button>
                          ))}
                        </div>
                        <label className="type-filter">
                          <SlidersHorizontal size={14} />
                          <select
                            aria-label={t("Employment type")}
                            value={type}
                            onChange={(e) => {
                              setType(e.target.value);
                              invalidateSearch();
                            }}
                          >
                            <option value="">{t("Job type")}</option>
                            <option value="Full-time">{t("Full-time")}</option>
                            <option value="Part-time">{t("Part-time")}</option>
                            <option value="Contract">{t("Contract")}</option>
                          </select>
                        </label>
                      </div>
                      <div className="sample-control">
                        <label>
                          <input
                            type="checkbox"
                            checked={includeSamples}
                            onChange={(e) => {
                              setIncludeSamples(e.target.checked);
                              invalidateSearch();
                            }}
                          />{" "}
                          {t("Include sample vacancies")}
                        </label>
                        <span>
                          {(notice ? t(notice) : "") ||
                            t(
                              "Sample vacancies illustrate the experience and cannot receive applications.",
                            )}
                        </span>
                      </div>
                      <div className="job-list">
                        {listed.length ? (
                          listed.map((job) => (
                            <article className="job-card" key={job.id}>
                              <div className="job-main">
                                <span
                                  className={`company-icon ${job.category === "Hospitality" ? "apricot" : job.category === "Office & admin" ? "lavender" : job.category === "Delivery" ? "blue" : ""}`}
                                >
                                  {categoryIcon(job.category)}
                                </span>
                                <div className="job-title">
                                  <div className="company-name">
                                    {job.company}
                                    {job.sample && (
                                      <span className="sample-label">
                                        {t("SAMPLE")}
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => showJob(job)}>
                                    <h3>
                                      {job.sample ? t(job.title) : job.title}
                                    </h3>
                                  </button>
                                  <div className="job-meta">
                                    <span>
                                      <MapPin />
                                      {job.location}
                                    </span>
                                    <span>
                                      <Clock3 />
                                      {t(job.type)}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  className="job-arrow"
                                  aria-label={`${t("View opportunity")}: ${job.title}`}
                                  onClick={() => showJob(job)}
                                >
                                  <ArrowUpRight />
                                </button>
                              </div>
                              <p className="job-description">
                                {job.sample
                                  ? t(job.description)
                                  : job.description}
                              </p>
                              <div className="job-card-bottom">
                                <div className="tags">
                                  <span>{t(job.category)}</span>
                                  <span>{t(job.shift)}</span>
                                </div>
                                <div className="pay">
                                  {salary(job, t, locale)}
                                  <small>
                                    {job.salaryMin !== null ||
                                    job.salaryMax !== null
                                      ? t("/ month")
                                      : ""}
                                  </small>
                                </div>
                              </div>
                              <div className="job-card-footer">
                                <span>
                                  {job.sample
                                    ? t(
                                        "Illustrative listing · not a live opening",
                                      )
                                    : t(
                                        "Employer posted · not independently verified",
                                      )}
                                </span>
                                <button onClick={() => showJob(job)}>
                                  {appliedIds.has(job.id)
                                    ? t("Applied")
                                    : t("View opportunity")}
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="empty-state">
                            <Search />
                            <h3>{t("No opportunities found")}</h3>
                            <p>
                              {t(
                                "Try a broader keyword or location. You can also include sample vacancies to explore the experience.",
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                    <aside className="right-rail">
                      <section className="voice-card">
                        <div className="small-label">
                          <span />
                          {t("LET’S START WITH YOU")}
                        </div>
                        <div className="voice-orb">
                          <Mic size={28} />
                          <span />
                        </div>
                        <h2>
                          {t("You have a story.")}
                          <br />
                          {t("Let’s hear it.")}
                        </h2>
                        <p>
                          {t(
                            "Shop experience? Helping at home? Tell us what you do. Your everyday skills count.",
                          )}
                        </p>
                        <button
                          className="button primary"
                          onClick={openProfile}
                        >
                          {t("Build my resume")} <ArrowRight size={16} />
                        </button>
                        <div className="voice-caption">
                          {t("Speak or type in your language.")}
                        </div>
                      </section>
                      <section className="profile-card">
                        <div className="profile-card-title">
                          <span className="profile-icon">
                            <UserRound size={18} />
                          </span>
                          <div>
                            <h3>
                              {profile
                                ? t("Your profile is ready")
                                : t("Make your potential visible")}
                            </h3>
                            <small>
                              {profile
                                ? t("Candidate-confirmed · self-reported")
                                : t("A few details make a difference")}
                            </small>
                          </div>
                        </div>
                        <div className="progress-track">
                          <i
                            style={{
                              width: `${Math.round((completed / 7) * 100)}%`,
                            }}
                          />
                        </div>
                        <p>
                          {profile
                            ? `${completed} / 7 ${t("profile fields completed")}`
                            : t(
                                "Start with your experience. A formal résumé isn’t required.",
                              )}
                        </p>
                        <button className="text-button" onClick={openProfile}>
                          {profile
                            ? t("Review my resume")
                            : t("Create my resume")}
                          <ArrowRight size={14} />
                        </button>
                      </section>
                      <section className="trust-note">
                        <ShieldCheck size={23} />
                        <div>
                          <h3>{t("Your words. Your control.")}</h3>
                          <p>
                            {t(
                              "You review your profile before it’s saved, and choose when to share it with an employer.",
                            )}
                          </p>
                        </div>
                      </section>
                    </aside>
                  </div>
                </>
              )}

              {workspace === "candidate" && view === "profile" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    {t("YOUR EXPERIENCE MATTERS")}
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>{t("Your profile")}</h1>
                      <p>
                        {t(
                          "A clear picture of what you know and the work you want.",
                        )}
                      </p>
                    </div>
                    <button className="button primary" onClick={openProfile}>
                      {profile ? t("Edit profile") : t("Create profile")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {profile ? (
                    <section className="full-card profile-view">
                      <div className="profile-large-icon">
                        <UserRound size={30} />
                      </div>
                      <h2>{profile.name}</h2>
                      <p>
                        {profile.targetRole} · {profile.location}
                      </p>
                      <span className="status-chip">
                        {t("Candidate-confirmed · self-reported")}
                      </span>
                      <div className="profile-sections">
                        <section>
                          <h3>{t("Experience, in your words")}</h3>
                          <p className="preserve-lines">{profile.experience}</p>
                        </section>
                        <section>
                          <h3>{t("Skills you reported")}</h3>
                          <p>{profile.skills || t("Not provided")}</p>
                        </section>
                        <section>
                          <h3>{t("Availability")}</h3>
                          <p>{profile.availability || t("Not provided")}</p>
                        </section>
                        <section>
                          <h3>{t("Preferred language")}</h3>
                          <p>{t(profile.language)}</p>
                        </section>
                      </div>
                      <div className="info-note">
                        <ShieldCheck size={18} />
                        {t(
                          "Your profile is private. Applying shares a snapshot with the owner of that vacancy.",
                        )}
                      </div>
                      <ResumeDownload />
                    </section>
                  ) : (
                    <div className="empty-state large">
                      <UserRound />
                      <h2>{t("Your next opportunity starts with you.")}</h2>
                      <p>
                        {t(
                          "Describe what you have done, including informal work. Review everything before saving.",
                        )}
                      </p>
                      <button className="button primary" onClick={openProfile}>
                        {t("Build my resume")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {workspace === "candidate" && view === "applications" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    {t("ONE STEP CLOSER")}
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>{t("My applications")}</h1>
                      <p>
                        {t(
                          "Your submitted profile, your progress, your next step.",
                        )}
                      </p>
                    </div>
                    <span className="count-badge">
                      {data?.applications.length || 0} {t("applications")}
                    </span>
                  </div>
                  {data?.applications.length ? (
                    <div className="application-list">
                      {data.applications.map((a) => (
                        <article
                          className="full-card application-card"
                          key={a.id}
                        >
                          <span className="company-icon">
                            {categoryIcon(a.job?.category || "")}
                          </span>
                          <div className="application-content">
                            <small>{a.job?.company}</small>
                            <h3>{a.job?.title || t("Vacancy unavailable")}</h3>
                            <p>
                              {a.job?.location} {t("· Applied")}{" "}
                              {new Date(a.createdAt).toLocaleDateString(
                                `${locale}-IN`,
                                { day: "numeric", month: "short" },
                              )}
                            </p>
                            <details>
                              <summary>
                                {t("View the profile snapshot you submitted")}
                              </summary>
                              <p>{a.snapshot.experience}</p>
                              <p>
                                <b>{t("Skills:")}</b>{" "}
                                {a.snapshot.skills || t("Not provided")}
                              </p>
                              <small>
                                {t(
                                  "Subsequent profile edits do not change this application.",
                                )}
                              </small>
                            </details>
                          </div>
                          <div className="application-actions">
                            <span className={`status-chip ${t(a.status)}`}>
                              {t(a.status)}
                            </span>
                            {a.status !== "withdrawn" && (
                              <button
                                className="text-button muted"
                                disabled={Boolean(busy)}
                                onClick={() =>
                                  void updateApplication(a.id, "withdrawn")
                                }
                              >
                                {t("Withdraw")}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <FileCheck2 />
                      <h2>{t("Your first application starts here.")}</h2>
                      <p>
                        {t(
                          "Find an opportunity, review the details, and share your confirmed profile.",
                        )}
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("discover")}
                      >
                        {t("Explore opportunities")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {workspace === "employer" && view === "overview" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    {t("GOOD PEOPLE. LOCAL POTENTIAL.")}
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>{t("Find your next teammate.")}</h1>
                      <p>
                        {t(
                          "Share the work. Discover the experience behind every application.",
                        )}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => {
                        setPostError("");
                        setPostOpen(true);
                      }}
                    >
                      <Plus size={17} />
                      {t("Post a vacancy")}
                    </button>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <BriefcaseBusiness />
                      <strong>
                        {data?.myJobs.filter((j) => j.status === "active")
                          .length || 0}
                      </strong>
                      <span>{t("Open vacancies")}</span>
                    </div>
                    <div className="stat-card">
                      <Users />
                      <strong>
                        {data?.employerApplications.filter(
                          (a) => a.status !== "withdrawn",
                        ).length || 0}
                      </strong>
                      <span>{t("Applications received")}</span>
                    </div>
                    <div className="stat-card">
                      <CheckCheck />
                      <strong>
                        {data?.employerApplications.filter(
                          (a) => a.status === "shortlisted",
                        ).length || 0}
                      </strong>
                      <span>{t("Manually shortlisted")}</span>
                    </div>
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>{t("Your vacancies")}</h2>
                      <p>
                        {t(
                          "Only you can manage these postings and their applications.",
                        )}
                      </p>
                    </div>
                  </div>
                  {data?.myJobs.length ? (
                    <div className="job-list">
                      {data.myJobs.map((j) => (
                        <article className="full-card employer-job" key={j.id}>
                          <div>
                            <div className="company-name">{j.company}</div>
                            <h3>{j.title}</h3>
                            <p>
                              <MapPin size={14} />
                              {j.location} · {salary(j, t, locale)} ·{" "}
                              {t(j.type)}
                            </p>
                            <span className={`status-chip ${t(j.status)}`}>
                              {t(j.status)}
                            </span>
                          </div>
                          <div className="employer-job-actions">
                            <button
                              className="button secondary"
                              onClick={() => navigate("applicants")}
                            >
                              {t("View applications")}
                              <ArrowRight size={15} />
                            </button>
                            <button
                              className="text-button muted"
                              disabled={Boolean(busy)}
                              onClick={() => void toggleJob(j)}
                            >
                              {busy === j.id
                                ? t("Updating…")
                                : j.status === "active"
                                  ? t("Close vacancy")
                                  : t("Reopen vacancy")}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <Building2 />
                      <h2>
                        {t("Great hiring starts with a clear opportunity.")}
                      </h2>
                      <p>
                        {t(
                          "Describe responsibilities, pay and requirements. Your posting will appear in job discovery.",
                        )}
                      </p>
                      <button
                        className="button primary"
                        onClick={() => setPostOpen(true)}
                      >
                        <Plus size={16} />
                        {t("Post your first vacancy")}
                      </button>
                    </div>
                  )}
                  <div className="info-note">
                    <ShieldCheck size={18} />
                    {t(
                      "Posting requires sign-in. A signed-in account is not independent business verification.",
                    )}
                  </div>
                </>
              )}

              {workspace === "employer" && view === "applicants" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    {t("SEE THE PERSON BEHIND THE PROFILE")}
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>{t("Your applicants")}</h1>
                      <p>
                        {t(
                          "Review their words. Ask useful questions. You make the decision.",
                        )}
                      </p>
                    </div>
                  </div>
                  {data?.employerApplications.length ? (
                    <div className="application-list">
                      {data.employerApplications.map((a) => (
                        <article
                          key={a.id}
                          className="full-card application-card"
                        >
                          <span className="candidate-avatar">
                            {a.snapshot.name.slice(0, 1)}
                          </span>
                          <div className="application-content">
                            <small>{a.job?.title}</small>
                            <h3>{a.snapshot.name}</h3>
                            <p>
                              {a.snapshot.location} · {a.snapshot.targetRole}
                            </p>
                          </div>
                          <span className={`status-chip ${t(a.status)}`}>
                            {t(a.status)}
                          </span>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setActiveApplicant(a);
                              setApplicantSummary(null);
                              setDetailError("");
                            }}
                          >
                            {t("Review")}
                            <ArrowRight size={15} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <Users />
                      <h2>{t("A place for your future team.")}</h2>
                      <p>
                        {t(
                          "Applications to your vacancies will appear here. You will only see profiles deliberately submitted to your postings.",
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              <footer className="page-footer">
                <span>
                  JobSathi <i>✳</i> {t("Every experience deserves a chance.")}
                </span>
                <button onClick={() => setHelpOpen(true)}>
                  {t("How it works")}
                  <ArrowUpRight size={13} />
                </button>
              </footer>
            </>
          )}
        </main>
      </div>

      {profileOpen && (
        <ResumeWizard
          profile={data?.profile || null}
          speechEnabled={Boolean(data?.ai.speech)}
          aiEnabled={Boolean(data?.ai.generation)}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => {
            await load();
            setProfileOpen(false);
            invalidateSearch();
            setToast({ source: "Your confirmed profile is saved." });
          }}
        />
      )}

      {selected && (
        <Dialog
          title={t("An opportunity worth exploring")}
          wide
          onClose={() => setSelected(null)}
        >
          <div className="detail-top">
            <span className="company-icon">
              {categoryIcon(selected.category)}
            </span>
            <div>
              <div className="company-name">
                {selected.company}
                {selected.sample && (
                  <span className="sample-label">{t("SAMPLE")}</span>
                )}
              </div>
              <h2>
                {shownTranslation?.title ||
                  (selected.sample ? t(selected.title) : selected.title)}
              </h2>
              <p>
                {selected.location} · {t(selected.type)}
              </p>
            </div>
          </div>
          {locale !== "en" && (
            <div className="job-translation-controls">
              <button
                className="text-button"
                type="button"
                onClick={() => void translateJob()}
                disabled={translationBusy}
              >
                {translationBusy
                  ? t("Translating job details…")
                  : t("Translate job details")}
              </button>
              {shownTranslation && (
                <small>
                  {t("AI translation · original wording available below")}
                </small>
              )}
            </div>
          )}
          <div className="detail-facts">
            <div>
              <small>{t("MONTHLY PAY")}</small>
              <b>{salary(selected, t, locale)}</b>
            </div>
            <div>
              <small>{t("SHIFT")}</small>
              <b>{t(selected.shift)}</b>
            </div>
            <div>
              <small>{t("APPLY BY")}</small>
              <b>{selected.deadline || t("Not specified")}</b>
            </div>
          </div>
          <section className="detail-section">
            <h3>{t("The work")}</h3>
            <p>
              {shownTranslation?.description ||
                (selected.sample
                  ? t(selected.description)
                  : selected.description)}
            </p>
          </section>
          <section className="detail-section">
            <h3>{t("What the employer is looking for")}</h3>
            <p>
              {shownTranslation?.requirements ||
                (selected.sample
                  ? t(selected.requirements)
                  : selected.requirements)}
            </p>
          </section>
          {shownTranslation && (
            <details className="job-original">
              <summary>{t("Original wording")}</summary>
              <p>
                <strong>{selected.title}</strong>
              </p>
              <p>{selected.description}</p>
              <p>{selected.requirements}</p>
            </details>
          )}
          <div className="rag-panel">
            <div className="rag-heading">
              <Sparkles size={19} />
              <h3>{t("Understand this opportunity")}</h3>
            </div>
            <p>
              {t(
                "Compare the posting with your confirmed experience, with supporting quotes.",
              )}
            </p>
            <div className="question-input">
              <input
                aria-label={t("Question about this vacancy")}
                maxLength={1000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("For example: is billing software required?")}
              />
              <button
                className="button primary"
                aria-label={t("Ask about this vacancy")}
                disabled={Boolean(busy)}
                onClick={() => void explain()}
              >
                {busy === "explain" ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>
            {!data?.ai.generation && (
              <small>
                {t(
                  "Grounded AI explanations need a connected Gemini account. The original posting remains available above.",
                )}
              </small>
            )}
            {explanation &&
              explanationLocale === locale &&
              explanation.jobId === selected.id && (
                <Evidence result={explanation} />
              )}
          </div>
          {selected.sample ? (
            <div className="info-note">
              <CircleHelp size={18} />
              {t(
                "This is an illustrative vacancy, not a live opening. To test applications, post a vacancy from the employer workspace.",
              )}
            </div>
          ) : appliedIds.has(selected.id) ? (
            <div className="info-note">
              <CheckCheck size={18} />
              {t(
                "You have already applied. View your application status in My applications.",
              )}
            </div>
          ) : (
            <>
              <label className="consent-box">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {t(
                    "I want to share my current confirmed profile with this vacancy’s owner. It is stored as an application snapshot.",
                  )}
                </span>
              </label>
              {profile ? (
                <p className="application-preview">
                  <b>{t("Sharing:")}</b> {profile.name} · {profile.targetRole} ·{" "}
                  {profile.location}
                  {t(". Includes your experience, skills and availability.")}
                </p>
              ) : (
                <p className="application-preview">
                  {t("Create a confirmed profile before applying.")}{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected(null);
                      openProfile();
                    }}
                  >
                    {t("Create profile")}
                    <ArrowRight size={13} />
                  </button>
                </p>
              )}
            </>
          )}
          {detailError && (
            <div className="alert error" role="alert">
              {t(detailError)}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setSelected(null)}
            >
              {t("Back to opportunities")}
            </button>
            {!selected.sample && !appliedIds.has(selected.id) && (
              <button
                className="button primary"
                disabled={!profile || !consent || Boolean(busy)}
                onClick={() => void apply()}
              >
                {busy === "apply" ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <>
                    {t("Submit application")}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </Dialog>
      )}

      {postOpen && (
        <Dialog
          title={t("Make room for someone’s next chapter")}
          wide
          onClose={() => setPostOpen(false)}
        >
          <form onSubmit={postJob}>
            <p className="dialog-intro">
              {t(
                "Be clear about the work and requirements. You remain responsible for the accuracy of this posting.",
              )}
            </p>
            <div className="form-grid">
              {(["title", "company", "location"] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    key === "title"
                      ? t("Job title")
                      : key === "company"
                        ? t("Company or business")
                        : t("Work location")
                  }
                >
                  <input
                    required
                    minLength={key === "title" ? 3 : 2}
                    maxLength={120}
                    value={jobDraft[key]}
                    onChange={(e) =>
                      setJobDraft((j) => ({ ...j, [key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
              <Field label={t("Category")}>
                <select
                  value={jobDraft.category}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, category: e.target.value }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Employment type")}>
                <select
                  value={jobDraft.type}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, type: e.target.value }))
                  }
                >
                  <option value="Full-time">{t("Full-time")}</option>
                  <option value="Part-time">{t("Part-time")}</option>
                  <option value="Contract">{t("Contract")}</option>
                </select>
              </Field>
              <Field label={t("Shift")}>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder={t("For example: day shift")}
                  value={jobDraft.shift}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, shift: e.target.value }))
                  }
                />
              </Field>
              <Field label={t("Monthly pay minimum (₹)")}>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={jobDraft.salaryMin}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, salaryMin: e.target.value }))
                  }
                  placeholder={t("Optional")}
                />
              </Field>
              <Field label={t("Monthly pay maximum (₹)")}>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={jobDraft.salaryMax}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, salaryMax: e.target.value }))
                  }
                  placeholder={t("Optional")}
                />
              </Field>
            </div>
            <Field label={t("Responsibilities")}>
              <textarea
                required
                minLength={20}
                maxLength={6000}
                rows={4}
                value={jobDraft.description}
                onChange={(e) =>
                  setJobDraft((j) => ({ ...j, description: e.target.value }))
                }
                placeholder={t(
                  "Describe the actual tasks and support or training offered.",
                )}
              />
            </Field>
            <Field
              label={t("Requirements")}
              hint={t(
                "Distinguish essentials from preferences. Do not ask for irrelevant personal traits.",
              )}
            >
              <textarea
                required
                minLength={10}
                maxLength={3000}
                rows={3}
                value={jobDraft.requirements}
                onChange={(e) =>
                  setJobDraft((j) => ({ ...j, requirements: e.target.value }))
                }
                placeholder={t("Required: … Preferred: …")}
              />
            </Field>
            <Field label={t("Application deadline")}>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={jobDraft.deadline}
                onChange={(e) =>
                  setJobDraft((j) => ({ ...j, deadline: e.target.value }))
                }
              />
            </Field>
            {postError && (
              <div className="alert error" role="alert">
                {t(postError)}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setPostOpen(false)}
              >
                {t("Cancel")}
              </button>
              <button className="button primary" disabled={Boolean(busy)}>
                {busy === "post" ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {t("Publish vacancy")}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {activeApplicant && (
        <Dialog
          title={t("Review application")}
          wide
          onClose={() => setActiveApplicant(null)}
        >
          <div className="detail-top">
            <span className="candidate-avatar">
              {activeApplicant.snapshot.name.slice(0, 1)}
            </span>
            <div>
              <small>{activeApplicant.job?.title}</small>
              <h2>{activeApplicant.snapshot.name}</h2>
              <p>
                {activeApplicant.snapshot.location} ·{" "}
                {activeApplicant.snapshot.targetRole}
              </p>
            </div>
          </div>
          <span className="status-chip">{activeApplicant.status}</span>
          <div className="profile-sections">
            <section>
              <h3>{t("Submitted experience")}</h3>
              <p className="preserve-lines">
                {activeApplicant.snapshot.experience}
              </p>
            </section>
            <section>
              <h3>{t("Reported skills")}</h3>
              <p>{activeApplicant.snapshot.skills || t("Not provided")}</p>
            </section>
            <section>
              <h3>{t("Availability")}</h3>
              <p>
                {activeApplicant.snapshot.availability || t("Not provided")}
              </p>
            </section>
          </div>
          {activeApplicant.status !== "withdrawn" && (
            <div className="rag-panel">
              <h3>{t("Evidence summary")}</h3>
              <p>
                {t(
                  "Compare this submitted profile with the vacancy. AI does not make the hiring decision.",
                )}
              </p>
              <button
                className="button secondary"
                disabled={Boolean(busy)}
                onClick={() => void summarize()}
              >
                <Sparkles size={15} />
                {busy === "summary"
                  ? t("Retrieving evidence…")
                  : t("Summarise submitted evidence")}
              </button>
              {applicantSummary &&
                applicantSummaryLocale === locale &&
                summaryApplicationId === activeApplicant.id && (
                  <Evidence result={applicantSummary} />
                )}
            </div>
          )}
          {detailError && (
            <div className="alert error" role="alert">
              {t(detailError)}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setActiveApplicant(null)}
            >
              {t("Close")}
            </button>
            {activeApplicant.status !== "withdrawn" && (
              <>
                <button
                  className="button secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateApplication(activeApplicant.id, "contacted")
                  }
                >
                  {t("Mark contacted")}
                </button>
                <button
                  className="button primary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateApplication(activeApplicant.id, "shortlisted")
                  }
                >
                  <Check size={16} />
                  {t("Shortlist manually")}
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}

      {helpOpen && (
        <Dialog
          title={t("A clearer path from experience to opportunity")}
          onClose={() => setHelpOpen(false)}
        >
          <div className="how-steps">
            <div>
              <span>01</span>
              <section>
                <h3>{t("Tell your story")}</h3>
                <p>
                  {t(
                    "Describe formal or informal work. Review your profile before saving.",
                  )}
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>{t("Explore and understand")}</h3>
                <p>
                  {t(
                    "Read current vacancy details. When AI is connected, ask for explanations with supporting quotes. A relevant result is not a guarantee of eligibility.",
                  )}
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>{t("Apply on your terms")}</h3>
                <p>
                  {t(
                    "Choose a vacancy and share a snapshot of your profile. Employers review applications and make their own decisions.",
                  )}
                </p>
              </section>
            </div>
          </div>
          <div className="info-note">
            {t(
              "Prototype: sample listings are clearly marked. Employers and candidate-reported skills are not independently verified.",
            )}
          </div>
          <div className="connection-status">
            <h3>{t("Connected services")}</h3>
            <p>
              <span className={data?.ai.generation ? "online" : "offline"} />
              {data?.ai.generation
                ? t("AI generation configured")
                : t("AI generation not connected")}
            </p>
            <p>
              <span className={data?.ai.embeddings ? "online" : "offline"} />
              {data?.ai.embeddings
                ? t("Semantic retrieval configured")
                : t("Keyword retrieval available")}
            </p>
            <p>
              <span className={data?.ai.speech ? "online" : "offline"} />
              {data?.ai.speech
                ? t("Voice transcription configured")
                : t("Voice transcription not connected")}
            </p>
            <small>
              {t(
                "Configured services still require a successful provider request. No AI results are simulated.",
              )}
            </small>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {t(toast.source)} {toast.status ? t(toast.status) : ""}
          <button
            aria-label={t("Dismiss notification")}
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Evidence({ result }: { result: Explanation }) {
  const { t } = useLanguage();
  return (
    <div className="evidence-list">
      {result.points.map((p, i) => (
        <div className="evidence-point" key={i}>
          <p>{p.text}</p>
          <details>
            <summary>
              {t("View source ·")} {t(p.source)}
            </summary>
            <blockquote>“{p.quote}”</blockquote>
          </details>
        </div>
      ))}
      {result.unknowns.length > 0 && (
        <div className="unknowns">
          <h4>{t("Still worth clarifying")}</h4>
          {result.unknowns.map((u, i) => (
            <p key={i}>{u}</p>
          ))}
        </div>
      )}
      <small className="evidence-caption">
        {t(
          "Sources show where statements came from; they are not independent verification. Vacancy version",
        )}{" "}
        {result.jobVersion}.
      </small>
    </div>
  );
}
