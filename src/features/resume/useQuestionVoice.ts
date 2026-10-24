"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/features/workspace/api";

type VoiceState = {
  scope: string;
  status: "idle" | "permission" | "recording" | "transcribing";
  seconds: number;
  transcript: string;
  error: string;
};

/** Each question and language owns its recording; cancelling never submits audio. */
export function useQuestionVoice(scope: string, language: string) {
  const [state, setState] = useState<VoiceState>({
    scope,
    status: "idle",
    seconds: 0,
    transcript: "",
    error: "",
  });
  const session = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const cancel = useCallback(() => {
    session.current += 1;
    request.current?.abort();
    request.current = null;
    const active = recorder.current;
    if (active) {
      active.onstop = null;
      active.ondataavailable = null;
      active.onerror = null;
      if (active.state !== "inactive") active.stop();
    }
    recorder.current = null;
    release();
  }, [release]);

  useEffect(() => () => cancel(), [scope, cancel]);

  function reset() {
    cancel();
    setState({ scope, status: "idle", seconds: 0, transcript: "", error: "" });
  }

  async function start() {
    cancel();
    const token = session.current;
    const update = (changes: Partial<VoiceState>) => {
      if (session.current === token)
        setState((previous) => ({ ...previous, scope, ...changes }));
    };
    setState({
      scope,
      status: "permission",
      seconds: 0,
      transcript: "",
      error: "",
    });
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      update({
        status: "idle",
        error:
          "Recording is not supported in this browser. You can type your answer.",
      });
      return;
    }
    try {
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (session.current !== token) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const active = new MediaRecorder(
        captured,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = active;
      const chunks: BlobPart[] = [];
      active.ondataavailable = (event) => {
        if (session.current === token && event.data.size)
          chunks.push(event.data);
      };
      active.onerror = () => {
        if (session.current !== token) return;
        cancel();
        setState({
          scope,
          status: "idle",
          seconds: 0,
          transcript: "",
          error:
            "Recording failed. Your typed answer is safe. Please try again.",
        });
      };
      active.onstop = async () => {
        if (session.current !== token) return;
        release();
        recorder.current = null;
        const audio = new Blob(chunks, {
          type: active.mimeType || "audio/webm",
        });
        if (audio.size < 100) {
          update({
            status: "idle",
            error:
              "No speech was detected. Please try again or type your answer.",
          });
          return;
        }
        const controller = new AbortController();
        request.current = controller;
        update({ status: "transcribing" });
        try {
          const data = new FormData();
          data.set(
            "audio",
            audio,
            audio.type.includes("mp4") ? "answer.m4a" : "answer.webm",
          );
          data.set("language", language);
          const result = await api<{ transcript: string }>("/api/transcribe", {
            method: "POST",
            body: data,
            signal: controller.signal,
          });
          update({ status: "idle", transcript: result.transcript, error: "" });
        } catch (error) {
          if (controller.signal.aborted) return;
          update({
            status: "idle",
            error:
              error instanceof Error
                ? error.message
                : "Transcription is temporarily unavailable. Please type or try another recording.",
          });
        } finally {
          if (request.current === controller) request.current = null;
        }
      };
      active.start();
      const startedAt = Date.now();
      update({ status: "recording" });
      timer.current = setInterval(() => {
        const seconds = Math.min(
          45,
          Math.floor((Date.now() - startedAt) / 1000),
        );
        update({ seconds });
        if (seconds >= 45 && active.state === "recording") active.stop();
      }, 250);
    } catch (error) {
      if (session.current !== token) return;
      release();
      update({
        status: "idle",
        error:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser settings or type your answer."
            : "Microphone access is unavailable. Please type your answer or try again.",
      });
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  const current =
    state.scope === scope
      ? state
      : {
          scope,
          status: "idle" as const,
          seconds: 0,
          transcript: "",
          error: "",
        };
  return { ...current, start, stop, reset, cancel };
}
