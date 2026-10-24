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
  Globe2,
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
  Square,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { api } from "./api";
import { useBootstrap } from "./useBootstrap";
import type { Explanation, Suggestion, JobDraft } from "./types";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import {
  CATEGORIES,
  EMPTY_PROFILE,
  type Application,
  type Job,
  type Profile,
} from "@/domain/types";
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
  shift: "Day shift",
  deadline: "",
};
const money = (value: number) => new Intl.NumberFormat("en-IN").format(value);
function salary(job: Job) {
  return job.salaryMin !== null && job.salaryMax !== null
    ? `₹${money(job.salaryMin)}–${money(job.salaryMax)}`
    : job.salaryMin !== null
      ? `From ₹${money(job.salaryMin)}`
      : job.salaryMax !== null
        ? `Up to ₹${money(job.salaryMax)}`
        : "Pay not specified";
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

export default function JobSathi() {
  const { data, loading, error, setError, reload: load } = useBootstrap();
  const [toast, setToast] = useState("");
  const [workspace, setWorkspace] = useState<"candidate" | "employer">(
    "candidate",
  );
  const [view, setView] = useState("discover"),
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
  const [profileOpen, setProfileOpen] = useState(false),
    [draft, setDraft] = useState<Profile>(EMPTY_PROFILE),
    [confirmed, setConfirmed] = useState(false),
    [profileError, setProfileError] = useState(""),
    [suggestions, setSuggestions] = useState<Suggestion | null>(null);
  const [postOpen, setPostOpen] = useState(false),
    [jobDraft, setJobDraft] = useState<JobDraft>(EMPTY_JOB),
    [postError, setPostError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false),
    [recording, setRecording] = useState(false),
    [activeApplicant, setActiveApplicant] = useState<Application | null>(null),
    [applicantSummary, setApplicantSummary] = useState<Explanation | null>(
      null,
    );
  const recorder = useRef<MediaRecorder | null>(null),
    recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunkRef = useRef<Blob[]>([]);
  useEffect(() => {
    return () => {
      if (recordTimer.current) clearTimeout(recordTimer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  const invalidateSearch = () => {
    setMatched(null);
    setNotice("");
    setSearchMode("browse");
  };
  const openProfile = () => {
    setDraft(data?.profile || { ...EMPTY_PROFILE });
    setSuggestions(null);
    setConfirmed(false);
    setProfileError("");
    setProfileOpen(true);
  };
  const setProfileField = (field: keyof Profile, value: string) => {
    setDraft((p) => ({ ...p, [field]: value }));
    setConfirmed(false);
    if (field === "experience") setSuggestions(null);
  };
  const navigate = (next: string) => {
    setView(next);
    setSelected(null);
  };
  const switchWorkspace = (next: "candidate" | "employer") => {
    setWorkspace(next);
    setView(next === "candidate" ? "discover" : "overview");
    setError("");
  };
  const search = async (e?: FormEvent) => {
    e?.preventDefault();
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
        const result = await api<{ jobs: Job[]; mode: string; notice: string }>(
          "/api/match",
          {
            method: "POST",
            body: JSON.stringify({
              query,
              location,
              category,
              type,
              includeSamples,
            }),
          },
        );
        setMatched(result.jobs);
        setSearchMode(result.mode);
        setNotice(result.notice);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("profile");
    setProfileError("");
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ profile: draft, confirmed }),
      });
      await load();
      setProfileOpen(false);
      invalidateSearch();
      setToast("Your confirmed profile is saved.");
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const extract = async () => {
    setBusy("extract");
    setProfileError("");
    try {
      const result = await api<Suggestion>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action: "extract",
          transcript: draft.experience,
          language: draft.language,
        }),
      });
      setSuggestions(result);
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (recordTimer.current) clearTimeout(recordTimer.current);
  };
  const record = async () => {
    setProfileError("");
    if (recording) {
      stopRecording();
      return;
    }
    if (!data?.ai.speech) {
      setProfileError(
        "Voice transcription is not connected yet. You can type in Malayalam or English below.",
      );
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "This browser cannot record audio. Please type your answer.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      chunkRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunkRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setRecording(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        setBusy("transcribe");
        try {
          const fd = new FormData();
          fd.set(
            "audio",
            new Blob(chunkRef.current, { type: rec.mimeType }),
            rec.mimeType.includes("mp4") ? "answer.m4a" : "answer.webm",
          );
          fd.set("language", draft.language);
          const result = await api<{ transcript: string }>("/api/transcribe", {
            method: "POST",
            body: fd,
          });
          setDraft((p) => ({
            ...p,
            experience: p.experience
              ? `${p.experience}\n${result.transcript}`
              : result.transcript,
          }));
          setConfirmed(false);
          setSuggestions(null);
        } catch (e) {
          setProfileError((e as Error).message);
        } finally {
          setBusy("");
        }
      };
      rec.start();
      setRecording(true);
      recordTimer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 45000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setProfileError(
        (e as Error).message ||
          "Microphone access was unavailable. Please type your answer.",
      );
    }
  };
  const showJob = (job: Job) => {
    setSelected(job);
    setExplanation(null);
    setDetailError("");
    setConsent(false);
    setQuestion("");
  };
  const explain = async () => {
    if (!selected) return;
    setBusy("explain");
    setDetailError("");
    try {
      setExplanation(
        await api<Explanation>("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "explain",
            jobId: selected.id,
            question,
          }),
        }),
      );
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
      setToast("Application submitted. You can track it in My applications.");
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
      setToast("Vacancy published. It is now available in job discovery.");
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
      setToast(
        job.status === "active"
          ? "Vacancy closed. New applications are blocked."
          : "Vacancy reopened.",
      );
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
      setToast(`Application ${status}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const summarize = async () => {
    if (!activeApplicant) return;
    setBusy("summary");
    setDetailError("");
    try {
      setApplicantSummary(
        await api<Explanation>("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "applicant",
            jobId: activeApplicant.jobId,
            applicationId: activeApplicant.id,
          }),
        }),
      );
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => {
            switchWorkspace("candidate");
            navigate("discover");
          }}
          aria-label="JobSathi home"
        >
          <span className="brand-symbol">
            <Handshake size={24} />
          </span>
          <span>
            Job<span className="brand-green">Sathi</span>
            <i />
          </span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {workspace === "candidate" ? (
            <>
              <button
                className={view === "discover" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("discover")}
              >
                <Search />
                Find opportunities
                <span className="nav-dot" />
              </button>
              <button
                className={
                  view === "applications" ? "nav-item active" : "nav-item"
                }
                onClick={() => navigate("applications")}
              >
                <FileCheck2 />
                My applications
                {Boolean(data?.applications.length) && (
                  <span className="nav-count">{data?.applications.length}</span>
                )}
              </button>
              <button
                className={view === "profile" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("profile")}
              >
                <UserRound />
                My profile
              </button>
            </>
          ) : (
            <>
              <button
                className={view === "overview" ? "nav-item active" : "nav-item"}
                onClick={() => navigate("overview")}
              >
                <BriefcaseBusiness />
                Your vacancies
              </button>
              <button
                className={
                  view === "applicants" ? "nav-item active" : "nav-item"
                }
                onClick={() => navigate("applicants")}
              >
                <Users />
                Applications
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
            A little support.
            <br />A new beginning.
          </h3>
          <p>Good work starts with being understood.</p>
          <button onClick={() => setHelpOpen(true)}>
            How JobSathi helps <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <CircleHelp />
            Help & how it works
          </button>
          <div className="made-for">
            <span />
            Built for local opportunities
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Handshake size={22} /> JobSathi
          </div>
          <div className="workspace-switch" aria-label="Choose workspace">
            <button
              className={workspace === "candidate" ? "selected" : ""}
              onClick={() => switchWorkspace("candidate")}
            >
              For jobseekers
            </button>
            <button
              className={workspace === "employer" ? "selected" : ""}
              onClick={() => switchWorkspace("employer")}
            >
              For employers <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="topbar-right">
            <span className="language-chip">
              <Globe2 size={15} /> EN <span>/</span> മലയാളം
            </span>
            {data?.user ? (
              <>
                <button
                  className="avatar"
                  aria-label="Open your profile"
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
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button className="sign-in" onClick={() => void signIn()}>
                Sign in <ArrowRight size={14} />
              </button>
            )}
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button
            onClick={() =>
              navigate(workspace === "candidate" ? "discover" : "overview")
            }
          >
            <Search size={16} />{" "}
            {workspace === "candidate" ? "Find jobs" : "Vacancies"}
          </button>
          <button
            onClick={() =>
              navigate(
                workspace === "candidate" ? "applications" : "applicants",
              )
            }
          >
            <FileCheck2 size={16} /> Applications
          </button>
          <button
            onClick={() =>
              workspace === "candidate"
                ? navigate("profile")
                : setPostOpen(true)
            }
          >
            <UserRound size={16} />
            {workspace === "candidate" ? "Profile" : "Post a job"}
          </button>
        </nav>
        <main className="main-content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => void load()}>Retry</button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <Loader2 className="spin" />
              <h2>Finding your starting point…</h2>
            </div>
          ) : (
            <>
              {workspace === "candidate" && view === "discover" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    YOUR NEXT CHAPTER STARTS HERE
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <h1>
                        Your experience.
                        <br />
                        Your next <em>opportunity.</em>
                      </h1>
                      <p>
                        You bring the skills. We help you put them into words
                        <br className="desktop-break" /> and find work that
                        fits.
                      </p>
                      <div className="hero-footnote">
                        <span className="tiny-avatars">
                          <i>S</i>
                          <i>A</i>
                          <i>J</i>
                        </span>
                        <span>
                          For first jobs, fresh starts, and everything in
                          between.
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
                          <b>Your story, in your words</b>
                          <small>മലയാളത്തിൽ തുടങ്ങാം</small>
                        </div>
                        <span className="wave">▂▅▃▇▅▂▆▃</span>
                      </div>
                      <div className="floating-card card-two">
                        <span className="art-icon peach">
                          <BriefcaseBusiness />
                        </span>
                        <div>
                          <b>A place for your potential</b>
                          <small>Local work. Real possibilities.</small>
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
                        aria-label="Job title, skill or keyword"
                        placeholder="Job title, skill, or something you're good at"
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
                        aria-label="Location"
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          invalidateSearch();
                        }}
                      >
                        <option value="">All locations</option>
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
                          Find opportunities <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="discovery-grid">
                    <section className="results">
                      <div className="section-heading">
                        <div>
                          <h2>
                            Find your next step <span>{listed.length}</span>
                          </h2>
                          <p>
                            {searchMode === "semantic"
                              ? "Ordered by related experience. You decide what fits."
                              : "Explore roles, read the details, and make your move."}
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
                          Reset filters
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
                            All opportunities
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
                              {c}
                            </button>
                          ))}
                        </div>
                        <label className="type-filter">
                          <SlidersHorizontal size={14} />
                          <select
                            aria-label="Employment type"
                            value={type}
                            onChange={(e) => {
                              setType(e.target.value);
                              invalidateSearch();
                            }}
                          >
                            <option value="">Job type</option>
                            <option>Full-time</option>
                            <option>Part-time</option>
                            <option>Contract</option>
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
                          Include sample vacancies
                        </label>
                        <span>
                          {notice ||
                            "Sample vacancies illustrate the experience and cannot receive applications."}
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
                                        SAMPLE
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => showJob(job)}>
                                    <h3>{job.title}</h3>
                                  </button>
                                  <div className="job-meta">
                                    <span>
                                      <MapPin />
                                      {job.location}
                                    </span>
                                    <span>
                                      <Clock3 />
                                      {job.type}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  className="job-arrow"
                                  aria-label={`View ${job.title}`}
                                  onClick={() => showJob(job)}
                                >
                                  <ArrowUpRight />
                                </button>
                              </div>
                              <p className="job-description">
                                {job.description}
                              </p>
                              <div className="job-card-bottom">
                                <div className="tags">
                                  <span>{job.category}</span>
                                  <span>{job.shift}</span>
                                </div>
                                <div className="pay">
                                  {salary(job)}
                                  <small>
                                    {job.salaryMin !== null ||
                                    job.salaryMax !== null
                                      ? "/ month"
                                      : ""}
                                  </small>
                                </div>
                              </div>
                              <div className="job-card-footer">
                                <span>
                                  {job.sample
                                    ? "Illustrative listing · not a live opening"
                                    : "Employer posted · not independently verified"}
                                </span>
                                <button onClick={() => showJob(job)}>
                                  {appliedIds.has(job.id)
                                    ? "Applied"
                                    : "View opportunity"}
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="empty-state">
                            <Search />
                            <h3>No opportunities found</h3>
                            <p>
                              Try a broader keyword or location. You can also
                              include sample vacancies to explore the
                              experience.
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                    <aside className="right-rail">
                      <section className="voice-card">
                        <div className="small-label">
                          <span />
                          LET’S START WITH YOU
                        </div>
                        <div className="voice-orb">
                          <Mic size={28} />
                          <span />
                        </div>
                        <h2>
                          You have a story.
                          <br />
                          Let’s hear it.
                        </h2>
                        <p>
                          Shop experience? Helping at home? Tell us what you do.
                          Your everyday skills count.
                        </p>
                        <button
                          className="button primary"
                          onClick={openProfile}
                        >
                          Build my profile <ArrowRight size={16} />
                        </button>
                        <div className="voice-caption">
                          മലയാളത്തിൽ പറയാം. You can type, too.
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
                                ? "Your profile is ready"
                                : "Make your potential visible"}
                            </h3>
                            <small>
                              {profile
                                ? "Candidate-confirmed · self-reported"
                                : "A few details make a difference"}
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
                            ? `${completed} of 7 profile fields completed.`
                            : "Start with your experience. A formal résumé isn’t required."}
                        </p>
                        <button className="text-button" onClick={openProfile}>
                          {profile ? "Review my profile" : "Create my profile"}
                          <ArrowRight size={14} />
                        </button>
                      </section>
                      <section className="trust-note">
                        <ShieldCheck size={23} />
                        <div>
                          <h3>Your words. Your control.</h3>
                          <p>
                            You review your profile before it’s saved, and
                            choose when to share it with an employer.
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
                    YOUR EXPERIENCE MATTERS
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>Your profile</h1>
                      <p>
                        A clear picture of what you know and the work you want.
                      </p>
                    </div>
                    <button className="button primary" onClick={openProfile}>
                      {profile ? "Edit profile" : "Create profile"}
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
                        Candidate-confirmed · self-reported
                      </span>
                      <div className="profile-sections">
                        <section>
                          <h3>Experience, in your words</h3>
                          <p className="preserve-lines">{profile.experience}</p>
                        </section>
                        <section>
                          <h3>Skills you reported</h3>
                          <p>{profile.skills || "Not provided"}</p>
                        </section>
                        <section>
                          <h3>Availability</h3>
                          <p>{profile.availability || "Not provided"}</p>
                        </section>
                        <section>
                          <h3>Preferred language</h3>
                          <p>{profile.language}</p>
                        </section>
                      </div>
                      <div className="info-note">
                        <ShieldCheck size={18} />
                        Your profile is private. Applying shares a snapshot with
                        the owner of that vacancy.
                      </div>
                    </section>
                  ) : (
                    <div className="empty-state large">
                      <UserRound />
                      <h2>Your next opportunity starts with you.</h2>
                      <p>
                        Describe what you have done, including informal work.
                        Review everything before saving.
                      </p>
                      <button className="button primary" onClick={openProfile}>
                        Build my profile
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
                    ONE STEP CLOSER
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>My applications</h1>
                      <p>
                        Your submitted profile, your progress, your next step.
                      </p>
                    </div>
                    <span className="count-badge">
                      {data?.applications.length || 0} applications
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
                            <h3>{a.job?.title || "Vacancy unavailable"}</h3>
                            <p>
                              {a.job?.location} · Applied{" "}
                              {new Date(a.createdAt).toLocaleDateString(
                                "en-IN",
                                { day: "numeric", month: "short" },
                              )}
                            </p>
                            <details>
                              <summary>
                                View the profile snapshot you submitted
                              </summary>
                              <p>{a.snapshot.experience}</p>
                              <p>
                                <b>Skills:</b>{" "}
                                {a.snapshot.skills || "Not provided"}
                              </p>
                              <small>
                                Subsequent profile edits do not change this
                                application.
                              </small>
                            </details>
                          </div>
                          <div className="application-actions">
                            <span className={`status-chip ${a.status}`}>
                              {a.status}
                            </span>
                            {a.status !== "withdrawn" && (
                              <button
                                className="text-button muted"
                                disabled={Boolean(busy)}
                                onClick={() =>
                                  void updateApplication(a.id, "withdrawn")
                                }
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <FileCheck2 />
                      <h2>Your first application starts here.</h2>
                      <p>
                        Find an opportunity, review the details, and share your
                        confirmed profile.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("discover")}
                      >
                        Explore opportunities
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
                    GOOD PEOPLE. LOCAL POTENTIAL.
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>Find your next teammate.</h1>
                      <p>
                        Share the work. Discover the experience behind every
                        application.
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
                      Post a vacancy
                    </button>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <BriefcaseBusiness />
                      <strong>
                        {data?.myJobs.filter((j) => j.status === "active")
                          .length || 0}
                      </strong>
                      <span>Open vacancies</span>
                    </div>
                    <div className="stat-card">
                      <Users />
                      <strong>
                        {data?.employerApplications.filter(
                          (a) => a.status !== "withdrawn",
                        ).length || 0}
                      </strong>
                      <span>Applications received</span>
                    </div>
                    <div className="stat-card">
                      <CheckCheck />
                      <strong>
                        {data?.employerApplications.filter(
                          (a) => a.status === "shortlisted",
                        ).length || 0}
                      </strong>
                      <span>Manually shortlisted</span>
                    </div>
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>Your vacancies</h2>
                      <p>
                        Only you can manage these postings and their
                        applications.
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
                              {j.location} · {salary(j)} · {j.type}
                            </p>
                            <span className={`status-chip ${j.status}`}>
                              {j.status}
                            </span>
                          </div>
                          <div className="employer-job-actions">
                            <button
                              className="button secondary"
                              onClick={() => navigate("applicants")}
                            >
                              View applications
                              <ArrowRight size={15} />
                            </button>
                            <button
                              className="text-button muted"
                              disabled={Boolean(busy)}
                              onClick={() => void toggleJob(j)}
                            >
                              {busy === j.id
                                ? "Updating…"
                                : j.status === "active"
                                  ? "Close vacancy"
                                  : "Reopen vacancy"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <Building2 />
                      <h2>Great hiring starts with a clear opportunity.</h2>
                      <p>
                        Describe responsibilities, pay and requirements. Your
                        posting will appear in job discovery.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => setPostOpen(true)}
                      >
                        <Plus size={16} />
                        Post your first vacancy
                      </button>
                    </div>
                  )}
                  <div className="info-note">
                    <ShieldCheck size={18} />
                    Posting requires sign-in. A signed-in account is not
                    independent business verification.
                  </div>
                </>
              )}

              {workspace === "employer" && view === "applicants" && (
                <>
                  <div className="page-eyebrow">
                    <span />
                    SEE THE PERSON BEHIND THE PROFILE
                  </div>
                  <div className="page-title">
                    <div>
                      <h1>Your applicants</h1>
                      <p>
                        Review their words. Ask useful questions. You make the
                        decision.
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
                          <span className={`status-chip ${a.status}`}>
                            {a.status}
                          </span>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setActiveApplicant(a);
                              setApplicantSummary(null);
                              setDetailError("");
                            }}
                          >
                            Review
                            <ArrowRight size={15} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state large">
                      <Users />
                      <h2>A place for your future team.</h2>
                      <p>
                        Applications to your vacancies will appear here. You
                        will only see profiles deliberately submitted to your
                        postings.
                      </p>
                    </div>
                  )}
                </>
              )}

              <footer className="page-footer">
                <span>
                  JobSathi <i>✳</i> Every experience deserves a chance.
                </span>
                <button onClick={() => setHelpOpen(true)}>
                  How it works
                  <ArrowUpRight size={13} />
                </button>
              </footer>
            </>
          )}
        </main>
      </div>

      {profileOpen && (
        <Dialog
          title={
            profile
              ? "Review your profile"
              : "Let’s put your experience into words"
          }
          wide
          onClose={() => {
            stopRecording();
            setProfileOpen(false);
          }}
        >
          <form onSubmit={saveProfile}>
            <p className="dialog-intro">
              Formal work, family work, volunteering—it all starts with what you
              actually did.
            </p>
            <div className="form-grid">
              <Field label="Your name">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setProfileField("name", e.target.value)}
                  placeholder="How should employers know you?"
                />
              </Field>
              <Field label="Your location">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={draft.location}
                  onChange={(e) => setProfileField("location", e.target.value)}
                  placeholder="Town or city"
                />
              </Field>
              <Field label="What work are you looking for?">
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={draft.targetRole}
                  onChange={(e) =>
                    setProfileField("targetRole", e.target.value)
                  }
                  placeholder="For example, retail assistant"
                />
              </Field>
              <Field label="Interview language">
                <select
                  value={draft.language}
                  onChange={(e) => setProfileField("language", e.target.value)}
                >
                  <option>Malayalam</option>
                  <option>English</option>
                </select>
              </Field>
            </div>
            <div className="experience-label">
              <label htmlFor="experience">
                Tell us about work you have done
              </label>
              <button
                type="button"
                className={`record-button ${recording ? "recording" : ""}`}
                onClick={() => void record()}
                disabled={Boolean(busy)}
              >
                {recording ? <Square size={14} /> : <Mic size={14} />}{" "}
                {recording ? "Stop recording" : "Record an answer"}
              </button>
            </div>
            <textarea
              id="experience"
              required
              minLength={10}
              maxLength={6000}
              rows={5}
              value={draft.experience}
              onChange={(e) => setProfileField("experience", e.target.value)}
              placeholder="What did you do? Where? For how long? Which tasks or tools did you use? You can type in Malayalam or English."
            />
            <p className="field-help">
              Share responsibilities, training and education relevant to work.
              Recording stops after 45 seconds. Review names, dates and numbers
              carefully.
            </p>
            <div className="ai-action-row">
              <button
                type="button"
                className="button secondary"
                onClick={() => void extract()}
                disabled={Boolean(busy) || draft.experience.length < 10}
              >
                <Sparkles size={15} />
                {busy === "extract"
                  ? "Looking for supporting details…"
                  : "Suggest skills & follow-up questions"}
              </button>
              <span>
                {data?.ai.generation
                  ? "AI connected"
                  : "AI not connected · manual editing available"}
              </span>
            </div>
            {suggestions && (
              <div className="suggestion-panel">
                <h3>Review the supporting evidence</h3>
                {suggestions.skills.map((s, i) => (
                  <div className="suggestion" key={i}>
                    <div>
                      <b>{s.text}</b>
                      <blockquote>“{s.quote}”</blockquote>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setProfileField(
                          "skills",
                          draft.skills ? `${draft.skills}, ${s.text}` : s.text,
                        )
                      }
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                ))}
                {suggestions.questions.length > 0 && (
                  <>
                    <h3>Useful things to clarify</h3>
                    {suggestions.questions.map((q) => (
                      <p key={q}>• {q}</p>
                    ))}
                    <small>
                      Add your answers to the experience box above, then review
                      again.
                    </small>
                  </>
                )}
              </div>
            )}
            <Field
              label="Skills you want to include"
              hint="Only include skills you can honestly describe. These remain self-reported."
            >
              <input
                maxLength={2000}
                value={draft.skills}
                onChange={(e) => setProfileField("skills", e.target.value)}
                placeholder="For example: arranging products, collecting payments"
              />
            </Field>
            <Field
              label="Availability and preferences"
              hint="Leave unknown details blank."
            >
              <input
                maxLength={500}
                value={draft.availability}
                onChange={(e) =>
                  setProfileField("availability", e.target.value)
                }
                placeholder="For example: day shifts, available from November"
              />
            </Field>
            <label className="consent-box">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I reviewed this profile and confirm it reflects my own
                experience. It will remain private until I apply.
              </span>
            </label>
            {profileError && (
              <div className="alert error" role="alert">
                {profileError}
              </div>
            )}
            {!data?.user && (
              <div className="info-note">
                Sign in before saving.{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void signIn()}
                >
                  Sign in
                </button>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  stopRecording();
                  setProfileOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={!confirmed || Boolean(busy) || recording}
              >
                {busy === "profile" ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                Save confirmed profile
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {selected && (
        <Dialog
          title="An opportunity worth exploring"
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
                  <span className="sample-label">SAMPLE</span>
                )}
              </div>
              <h2>{selected.title}</h2>
              <p>
                {selected.location} · {selected.type}
              </p>
            </div>
          </div>
          <div className="detail-facts">
            <div>
              <small>MONTHLY PAY</small>
              <b>{salary(selected)}</b>
            </div>
            <div>
              <small>SHIFT</small>
              <b>{selected.shift}</b>
            </div>
            <div>
              <small>APPLY BY</small>
              <b>{selected.deadline || "Not specified"}</b>
            </div>
          </div>
          <section className="detail-section">
            <h3>The work</h3>
            <p>{selected.description}</p>
          </section>
          <section className="detail-section">
            <h3>What the employer is looking for</h3>
            <p>{selected.requirements}</p>
          </section>
          <div className="rag-panel">
            <div className="rag-heading">
              <Sparkles size={19} />
              <h3>Understand this opportunity</h3>
            </div>
            <p>
              Compare the posting with your confirmed experience, with
              supporting quotes.
            </p>
            <div className="question-input">
              <input
                aria-label="Question about this vacancy"
                maxLength={1000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="For example: is billing software required?"
              />
              <button
                className="button primary"
                aria-label="Ask about this vacancy"
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
                Grounded AI explanations need a connected Gemini account. The
                original posting remains available above.
              </small>
            )}
            {explanation && <Evidence result={explanation} />}
          </div>
          {selected.sample ? (
            <div className="info-note">
              <CircleHelp size={18} />
              This is an illustrative vacancy, not a live opening. To test
              applications, post a vacancy from the employer workspace.
            </div>
          ) : appliedIds.has(selected.id) ? (
            <div className="info-note">
              <CheckCheck size={18} />
              You have already applied. View your application status in My
              applications.
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
                  I want to share my current confirmed profile with this
                  vacancy’s owner. It is stored as an application snapshot.
                </span>
              </label>
              {profile ? (
                <p className="application-preview">
                  <b>Sharing:</b> {profile.name} · {profile.targetRole} ·{" "}
                  {profile.location}. Includes your experience, skills and
                  availability.
                </p>
              ) : (
                <p className="application-preview">
                  Create a confirmed profile before applying.{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected(null);
                      openProfile();
                    }}
                  >
                    Create profile
                    <ArrowRight size={13} />
                  </button>
                </p>
              )}
            </>
          )}
          {detailError && (
            <div className="alert error" role="alert">
              {detailError}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setSelected(null)}
            >
              Back to opportunities
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
                    Submit application
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
          title="Make room for someone’s next chapter"
          wide
          onClose={() => setPostOpen(false)}
        >
          <form onSubmit={postJob}>
            <p className="dialog-intro">
              Be clear about the work and requirements. You remain responsible
              for the accuracy of this posting.
            </p>
            <div className="form-grid">
              {(["title", "company", "location"] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    key === "title"
                      ? "Job title"
                      : key === "company"
                        ? "Company or business"
                        : "Work location"
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
              <Field label="Category">
                <select
                  value={jobDraft.category}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, category: e.target.value }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Employment type">
                <select
                  value={jobDraft.type}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, type: e.target.value }))
                  }
                >
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </Field>
              <Field label="Shift">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={jobDraft.shift}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, shift: e.target.value }))
                  }
                />
              </Field>
              <Field label="Monthly pay minimum (₹)">
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={jobDraft.salaryMin}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, salaryMin: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </Field>
              <Field label="Monthly pay maximum (₹)">
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={jobDraft.salaryMax}
                  onChange={(e) =>
                    setJobDraft((j) => ({ ...j, salaryMax: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field label="Responsibilities">
              <textarea
                required
                minLength={20}
                maxLength={6000}
                rows={4}
                value={jobDraft.description}
                onChange={(e) =>
                  setJobDraft((j) => ({ ...j, description: e.target.value }))
                }
                placeholder="Describe the actual tasks and support or training offered."
              />
            </Field>
            <Field
              label="Requirements"
              hint="Distinguish essentials from preferences. Do not ask for irrelevant personal traits."
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
                placeholder="Required: … Preferred: …"
              />
            </Field>
            <Field label="Application deadline">
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
                {postError}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setPostOpen(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={Boolean(busy)}>
                {busy === "post" ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Publish vacancy
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {activeApplicant && (
        <Dialog
          title="Review application"
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
              <h3>Submitted experience</h3>
              <p className="preserve-lines">
                {activeApplicant.snapshot.experience}
              </p>
            </section>
            <section>
              <h3>Reported skills</h3>
              <p>{activeApplicant.snapshot.skills || "Not provided"}</p>
            </section>
            <section>
              <h3>Availability</h3>
              <p>{activeApplicant.snapshot.availability || "Not provided"}</p>
            </section>
          </div>
          {activeApplicant.status !== "withdrawn" && (
            <div className="rag-panel">
              <h3>Evidence summary</h3>
              <p>
                Compare this submitted profile with the vacancy. AI does not
                make the hiring decision.
              </p>
              <button
                className="button secondary"
                disabled={Boolean(busy)}
                onClick={() => void summarize()}
              >
                <Sparkles size={15} />
                {busy === "summary"
                  ? "Retrieving evidence…"
                  : "Summarise submitted evidence"}
              </button>
              {applicantSummary && <Evidence result={applicantSummary} />}
            </div>
          )}
          {detailError && (
            <div className="alert error" role="alert">
              {detailError}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setActiveApplicant(null)}
            >
              Close
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
                  Mark contacted
                </button>
                <button
                  className="button primary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateApplication(activeApplicant.id, "shortlisted")
                  }
                >
                  <Check size={16} />
                  Shortlist manually
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}

      {helpOpen && (
        <Dialog
          title="A clearer path from experience to opportunity"
          onClose={() => setHelpOpen(false)}
        >
          <div className="how-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Tell your story</h3>
                <p>
                  Describe formal or informal work. Review your profile before
                  saving.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Explore and understand</h3>
                <p>
                  Read current vacancy details. When AI is connected, ask for
                  explanations with supporting quotes. A relevant result is not
                  a guarantee of eligibility.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Apply on your terms</h3>
                <p>
                  Choose a vacancy and share a snapshot of your profile.
                  Employers review applications and make their own decisions.
                </p>
              </section>
            </div>
          </div>
          <div className="info-note">
            Prototype: sample listings are clearly marked. Employers and
            candidate-reported skills are not independently verified.
          </div>
          <div className="connection-status">
            <h3>Connected services</h3>
            <p>
              <span className={data?.ai.generation ? "online" : "offline"} />
              {data?.ai.generation
                ? "AI generation configured"
                : "AI generation not connected"}
            </p>
            <p>
              <span className={data?.ai.embeddings ? "online" : "offline"} />
              {data?.ai.embeddings
                ? "Semantic retrieval configured"
                : "Keyword retrieval available"}
            </p>
            <p>
              <span className={data?.ai.speech ? "online" : "offline"} />
              {data?.ai.speech
                ? "Voice transcription configured"
                : "Voice transcription not connected"}
            </p>
            <small>
              Configured services still require a successful provider request.
              No AI results are simulated.
            </small>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Evidence({ result }: { result: Explanation }) {
  return (
    <div className="evidence-list">
      {result.points.map((p, i) => (
        <div className="evidence-point" key={i}>
          <p>{p.text}</p>
          <details>
            <summary>View source · {p.source}</summary>
            <blockquote>“{p.quote}”</blockquote>
          </details>
        </div>
      ))}
      {result.unknowns.length > 0 && (
        <div className="unknowns">
          <h4>Still worth clarifying</h4>
          {result.unknowns.map((u, i) => (
            <p key={i}>{u}</p>
          ))}
        </div>
      )}
      <small className="evidence-caption">
        Sources show where statements came from; they are not independent
        verification. Vacancy version {result.jobVersion}.
      </small>
    </div>
  );
}
