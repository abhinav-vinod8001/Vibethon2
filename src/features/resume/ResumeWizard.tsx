"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  Square,
  WandSparkles,
} from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { EMPTY_PROFILE, type Profile } from "@/domain/types";
import { profileSchema } from "@/domain/validation";
import { useLanguage } from "@/features/language/LanguageProvider";
import { LANGUAGES } from "@/i18n/languages";
import { api } from "@/features/workspace/api";
import type { Suggestion } from "@/features/workspace/types";
import { MAX_RECORDING_SECONDS, useQuestionVoice } from "./useQuestionVoice";

const QUESTIONS = [
  {
    field: "name",
    title: "What name should appear on your resume?",
    label: "Your name",
    help: "Use the name you want employers to see.",
    min: 2,
    max: 100,
  },
  {
    field: "location",
    title: "Where do you live?",
    label: "Town or city",
    help: "Your town or city is enough. Do not include your full home address.",
    min: 2,
    max: 100,
  },
  {
    field: "targetRole",
    title: "What kind of work are you looking for?",
    label: "Preferred work",
    help: "For example: shop assistant, delivery partner, office work, or cooking.",
    min: 2,
    max: 120,
  },
  {
    field: "experience",
    title: "Tell us about work you have done.",
    label: "Your experience",
    help: "Paid work, family responsibilities, training, and volunteering all count. Describe what you did in your own words.",
    min: 10,
    max: 6000,
  },
  {
    field: "skills",
    title: "Which skills would you like to include?",
    label: "Your skills",
    help: "For example: customer service, cooking, organising stock, or using a computer. Separate skills with commas.",
    min: 0,
    max: 2000,
  },
  {
    field: "availability",
    title: "When can you work?",
    label: "Availability and preferences",
    help: "Tell us your preferred days, working hours, and when you can start.",
    min: 0,
    max: 500,
  },
] as const;

export function ResumeWizard({
  profile,
  onClose,
  onSaved,
  speechEnabled = false,
  aiEnabled = false,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  speechEnabled?: boolean;
  aiEnabled?: boolean;
}) {
  const { locale, t } = useLanguage();
  const language = LANGUAGES.find((item) => item.code === locale)!;
  const [draft, setDraft] = useState<Profile>(() =>
    profile ? { ...profile } : { ...EMPTY_PROFILE, language: language.name },
  );
  const initial = useRef(draft);
  const [step, setStep] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<{
    controller: AbortController;
    locale: string;
    step: number;
  } | null>(null);
  const [suggestion, setSuggestion] = useState<
    (Suggestion & { experience: string; locale: string }) | null
  >(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const extraction = useRef<AbortController | null>(null);
  const saveRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const review = step === QUESTIONS.length;
  const question = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const voice = useQuestionVoice(
    `${question.field}:${locale}:${step}`,
    language.name,
  );
  const busyVoice = voice.status !== "idle";
  const suggesting =
    pendingExtraction?.locale === locale &&
    pendingExtraction.step === step &&
    !pendingExtraction.controller.signal.aborted;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      extraction.current?.abort();
      saveRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    return () => extraction.current?.abort();
  }, [step, locale]);

  function change(field: keyof Profile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setConfirmed(false);
    setError("");
    if (field === "experience") {
      extraction.current?.abort();
      setPendingExtraction(null);
      setSuggestion(null);
    }
  }

  function navigate(next: number) {
    voice.reset();
    extraction.current?.abort();
    setPendingExtraction(null);
    setSuggestionError("");
    setError("");
    setStep(next);
  }

  function next() {
    if (
      !profileSchema.shape[question.field].safeParse(draft[question.field])
        .success
    ) {
      setError(
        draft[question.field].trim().length > question.max
          ? "This answer is too long. Please shorten it."
          : question.min === 10
            ? "Please describe your experience in at least 10 characters."
            : "Please enter at least 2 characters.",
      );
      return;
    }
    navigate(returnToReview ? QUESTIONS.length : step + 1);
    setReturnToReview(false);
  }

  function requestClose() {
    if (saving) return;
    voice.reset();
    extraction.current?.abort();
    setPendingExtraction(null);
    if (JSON.stringify(draft) !== JSON.stringify(initial.current))
      setDiscardOpen(true);
    else onClose();
  }

  async function suggestSkills() {
    extraction.current?.abort();
    const controller = new AbortController();
    extraction.current = controller;
    const experience = draft.experience;
    setPendingExtraction({ controller, locale, step });
    setSuggestionError("");
    try {
      const result = await api<Suggestion>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action: "extract",
          transcript: experience,
          language: language.name,
          locale,
        }),
        signal: controller.signal,
      });
      if (
        extraction.current === controller &&
        !controller.signal.aborted &&
        mounted.current
      )
        setSuggestion({ ...result, experience, locale });
    } catch (failure) {
      if (
        extraction.current === controller &&
        !controller.signal.aborted &&
        mounted.current
      )
        setSuggestionError(
          failure instanceof Error
            ? failure.message
            : "Skill suggestions are unavailable. You can enter your skills yourself.",
        );
    } finally {
      if (mounted.current)
        setPendingExtraction((current) =>
          current?.controller === controller ? null : current,
        );
      if (extraction.current === controller) extraction.current = null;
    }
  }

  async function save() {
    if (!confirmed) {
      setError("Please confirm your answers before saving.");
      return;
    }
    const result = profileSchema.safeParse(draft);
    if (!result.success) {
      const invalid = QUESTIONS.findIndex((item) =>
        result.error.issues.some((issue) => issue.path[0] === item.field),
      );
      if (invalid >= 0) navigate(invalid);
      setError("Please check this answer before saving.");
      return;
    }
    setSaving(true);
    setError("");
    const controller = new AbortController();
    saveRequest.current = controller;
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ profile: result.data, confirmed: true }),
        signal: controller.signal,
      });
      if (!mounted.current) return;
      initial.current = result.data;
      await onSaved();
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Your profile could not be saved. Please try again.",
        );
    } finally {
      if (saveRequest.current === controller) saveRequest.current = null;
      if (mounted.current) setSaving(false);
    }
  }

  const visibleSuggestion =
    suggestion?.experience === draft.experience && suggestion.locale === locale
      ? suggestion
      : null;
  const inputId = `resume-${question.field}`;
  const helpId = `${inputId}-help`;

  return (
    <Dialog title={t("Build your resume")} wide onClose={requestClose}>
      <div className="resume-wizard">
        <div className="wizard-progress">
          <span>
            {review
              ? t("Review your answers")
              : `${t("Question")} ${step + 1} ${t("of")} ${QUESTIONS.length}`}
          </span>
          <span>{t("Your answers stay here until you save or close.")}</span>
          <progress
            aria-label={t("Resume progress")}
            max={QUESTIONS.length + 1}
            value={step + 1}
          />
        </div>

        {discardOpen ? (
          <div className="question-card">
            <h3>{t("Leave without saving?")}</h3>
            <p>
              {t(
                "Your unsaved answers will be lost. You can stay and finish your resume.",
              )}
            </p>
            <div className="wizard-navigation">
              <button className="button secondary" onClick={onClose}>
                {t("Leave without saving")}
              </button>
              <button
                className="button primary"
                onClick={() => setDiscardOpen(false)}
              >
                {t("Keep editing")}
              </button>
            </div>
          </div>
        ) : review ? (
          <div className="resume-review">
            <h3 ref={heading} tabIndex={-1}>
              {t("Review your answers")}
            </h3>
            <p>
              {t(
                "Check every answer. Only include information you are comfortable sharing with employers when you apply.",
              )}
            </p>
            {QUESTIONS.map((item, index) => (
              <div className="review-item" key={item.field}>
                <div>
                  <strong>{t(item.label)}</strong>
                  <p>{draft[item.field] || t("Not provided")}</p>
                </div>
                <button
                  className="text-button"
                  disabled={saving}
                  aria-label={`${t("Edit")}: ${t(item.label)}`}
                  onClick={() => {
                    setReturnToReview(true);
                    navigate(index);
                  }}
                >
                  {t("Edit")}
                </button>
              </div>
            ))}
            <label className="confirm-row">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={saving}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                {t("I have checked my answers and confirm they are accurate.")}
              </span>
            </label>
            <p className="muted">
              {t(
                "Save your resume first. You can download it as a PDF from My Resume.",
              )}
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {t(error)}
              </p>
            )}
            <div className="wizard-navigation">
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => navigate(QUESTIONS.length - 1)}
              >
                <ArrowLeft size={16} />
                {t("Back")}
              </button>
              <button
                className="button primary"
                disabled={saving || !confirmed}
                onClick={() => void save()}
              >
                <Check size={16} />
                {saving ? t("Saving…") : t("Save my resume")}
              </button>
            </div>
          </div>
        ) : (
          <div className="question-card">
            <h3 ref={heading} tabIndex={-1}>
              {t(question.title)}
            </h3>
            <p id={helpId}>
              {t(question.help)}{" "}
              {question.min === 0 && (
                <span className="optional-label">{t("Optional")}</span>
              )}
            </p>
            <label className="field" htmlFor={inputId}>
              <span>{t(question.label)}</span>
              {question.field === "experience" ||
              question.field === "skills" ||
              question.field === "availability" ? (
                <textarea
                  id={inputId}
                  value={draft[question.field]}
                  onChange={(event) =>
                    change(question.field, event.target.value)
                  }
                  maxLength={question.max}
                  rows={question.field === "experience" ? 6 : 4}
                  aria-describedby={helpId}
                  aria-invalid={Boolean(error)}
                />
              ) : (
                <input
                  id={inputId}
                  value={draft[question.field]}
                  onChange={(event) =>
                    change(question.field, event.target.value)
                  }
                  maxLength={question.max}
                  autoComplete={
                    question.field === "name"
                      ? "name"
                      : question.field === "location"
                        ? "address-level2"
                        : "off"
                  }
                  aria-describedby={helpId}
                  aria-invalid={Boolean(error)}
                />
              )}
            </label>
            <small className="answer-count">
              {draft[question.field].length} / {question.max} {t("characters")}
            </small>
            <div className="voice-controls">
              {voice.status === "recording" ? (
                <button
                  className="button secondary recording"
                  onClick={voice.stop}
                >
                  <Square size={16} />
                  {t("Stop recording")} ({voice.seconds} /{" "}
                  {MAX_RECORDING_SECONDS} {t("seconds")})
                </button>
              ) : (
                <button
                  className="button secondary"
                  disabled={!speechEnabled || busyVoice}
                  onClick={() => void voice.start()}
                >
                  <Mic size={16} />
                  {voice.status === "permission"
                    ? t("Waiting for microphone…")
                    : voice.status === "transcribing"
                      ? t("Converting speech to text…")
                      : t("Speak your answer")}
                </button>
              )}
              {busyVoice && (
                <button className="text-button" onClick={voice.reset}>
                  {t("Cancel recording")}
                </button>
              )}
            </div>
            <p className="muted">
              {speechEnabled
                ? t(
                    "Type, speak, or use both. Record up to 25 seconds; review the transcript before adding it.",
                  )
                : t(
                    "Voice is not available right now. You can complete every question by typing.",
                  )}
            </p>
            <div role="status" aria-live="polite">
              {voice.status === "recording" && (
                <p>{t("Recording… You can keep typing.")}</p>
              )}
              {voice.status === "transcribing" && (
                <p>
                  {t(
                    "Your recording is being transcribed. Your typed answer is safe.",
                  )}
                </p>
              )}
            </div>
            {voice.error && (
              <p className="inline-error" role="alert">
                {t(voice.error)}
              </p>
            )}
            {voice.transcript && (
              <div className="transcript-preview">
                <strong>{t("Review your transcript")}</strong>
                <p>{voice.transcript}</p>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={() => {
                      const value = [
                        draft[question.field].trim(),
                        voice.transcript.trim(),
                      ]
                        .filter(Boolean)
                        .join(" ");
                      if (value.length > question.max) {
                        setError(
                          "This answer is too long. Shorten it before adding the transcript.",
                        );
                        return;
                      }
                      change(question.field, value);
                      voice.reset();
                    }}
                  >
                    {t("Add to my answer")}
                  </button>
                  <button className="text-button" onClick={voice.reset}>
                    {t("Discard transcript")}
                  </button>
                </div>
              </div>
            )}
            {question.field === "skills" && aiEnabled && (
              <div className="skill-suggestions">
                <button
                  className="button secondary"
                  disabled={suggesting || draft.experience.trim().length < 10}
                  onClick={() => void suggestSkills()}
                >
                  <WandSparkles size={16} />
                  {suggesting
                    ? t("Finding suggestions…")
                    : t("Suggest skills from my experience")}
                </button>
                <p className="muted">
                  {t(
                    "Suggestions are optional. Add only skills you recognise; nothing is added automatically.",
                  )}
                </p>
                {suggestionError && (
                  <p className="inline-error" role="alert">
                    {t(suggestionError)}
                  </p>
                )}
                {visibleSuggestion?.skills.length === 0 && (
                  <p>
                    {t(
                      "No supported skills were found. You can enter your own.",
                    )}
                  </p>
                )}
                {visibleSuggestion?.skills.map((skill) => {
                  const included = draft.skills
                    .split(/[,\n]/)
                    .some(
                      (entry) =>
                        entry.trim().toLocaleLowerCase() ===
                        skill.text.trim().toLocaleLowerCase(),
                    );
                  return (
                    <div className="skill-suggestion" key={skill.text}>
                      <div>
                        <strong>{skill.text}</strong>
                        <blockquote>{skill.quote}</blockquote>
                      </div>
                      <button
                        className="text-button"
                        disabled={included}
                        onClick={() => {
                          const value = [draft.skills.trim(), skill.text]
                            .filter(Boolean)
                            .join(", ");
                          if (value.length > 2000) {
                            setError(
                              "This answer is too long. Please shorten it.",
                            );
                            return;
                          }
                          change("skills", value);
                        }}
                      >
                        {included ? t("Added") : t("Add skill")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {t(error)}
              </p>
            )}
            <div className="wizard-navigation">
              <button
                className="button secondary"
                disabled={step === 0}
                onClick={() => navigate(step - 1)}
              >
                <ArrowLeft size={16} />
                {t("Back")}
              </button>
              {question.min === 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    navigate(returnToReview ? QUESTIONS.length : step + 1);
                    setReturnToReview(false);
                  }}
                >
                  {t("Skip for now")}
                </button>
              )}
              <button className="button primary" onClick={next}>
                {returnToReview || step === QUESTIONS.length - 1
                  ? t("Review answers")
                  : t("Next")}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
