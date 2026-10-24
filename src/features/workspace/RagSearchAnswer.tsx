"use client";

import { Sparkles } from "lucide-react";
import type { Job } from "@/domain/types";
import type { RagAnswer } from "./types";
import { useLanguage } from "@/features/language/LanguageProvider";

export function RagSearchAnswer({
  answer,
  onViewJob,
}: {
  answer: RagAnswer;
  onViewJob: (job: Job) => void;
}) {
  const { t } = useLanguage();
  if (answer.empty || !answer.points.length) return null;
  return (
    <section
      className="rag-panel search-answer"
      aria-label={t("Evidence summary")}
    >
      <h3>
        <Sparkles size={16} aria-hidden="true" />
        {t(
          answer.mode === "rag"
            ? "AI answer from current vacancies"
            : "Current vacancy facts",
        )}
      </h3>
      <div className="evidence-list">
        {answer.points.map((point, index) => (
          <div className="evidence-point" key={index}>
            <p>{point.text}</p>
            {point.citations.map((citation, citationIndex) => {
              const job = answer.jobs.find(
                (item) =>
                  item.id === citation.jobId &&
                  item.version === citation.jobVersion,
              );
              if (!job) return null;
              return (
                <details key={`${citation.jobId}:${citationIndex}`}>
                  <summary>
                    {t("View source ·")} {job.title} · {t(citation.field)}
                  </summary>
                  <blockquote>“{citation.quote}”</blockquote>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onViewJob(job)}
                  >
                    {t("View opportunity")}
                  </button>
                </details>
              );
            })}
          </div>
        ))}
      </div>
      {answer.unknowns.length > 0 && (
        <div className="unknowns">
          <h4>{t("Still worth clarifying")}</h4>
          {answer.unknowns.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
      <small>{t(answer.notice)}</small>
    </section>
  );
}
