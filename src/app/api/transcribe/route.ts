import { secrets } from "@/server/ai";
import { checkOrigin, HttpError, identity, json, route } from "@/server/http";
import { requestLocale, speechLanguage } from "@/server/language";

export const maxDuration = 60;

export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    await identity();
    const { SARVAM_API_KEY: key, SARVAM_MODEL: model } = secrets();
    if (!key)
      throw new HttpError(
        503,
        "Voice transcription is not connected yet. Please type your answer; your progress is preserved.",
      );
    if (Number(request.headers.get("content-length")) > 4500000)
      throw new HttpError(413, "Please record a shorter answer.");
    const input = await request.formData();
    const file = input.get("audio");
    if (!(file instanceof File) || file.size > 4000000 || file.size < 100)
      throw new HttpError(400, "Please send an audio recording under 4 MB.");
    const locale = await requestLocale(input.get("locale"));
    const language = speechLanguage(input.get("language"), locale);
    const data = new FormData();
    const extension = file.type.includes("mp4")
      ? "m4a"
      : file.type.includes("ogg")
        ? "ogg"
        : "webm";
    const cleanType =
      extension === "m4a"
        ? "audio/mp4"
        : extension === "ogg"
          ? "audio/ogg"
          : "audio/webm";
    const bytes = await file.arrayBuffer();
    const cleanFile = new File([bytes], `answer.${extension}`, {
      type: cleanType,
    });
    data.set("file", cleanFile);
    data.set("language_code", language);
    data.set("mode", "transcribe");
    data.set("model", model || "saaras:v4");
    let response: Response;
    try {
      response = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": key },
        body: data,
        signal: AbortSignal.timeout(45000),
      });
    } catch (error) {
      console.error("Sarvam transcription request failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
      throw new HttpError(
        502,
        "Transcription is temporarily unavailable. Please type or try another recording.",
      );
    }
    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {}
      console.error("Sarvam transcription failed", {
        status: response.status,
        model: model || "saaras:v4",
        language,
        detail,
      });
      throw new HttpError(
        response.status === 413 ? 413 : 502,
        response.status === 413
          ? "Please record a shorter answer."
          : response.status === 401 || response.status === 403
            ? "Voice transcription is not connected yet. Please type your answer; your progress is preserved."
            : "Transcription is temporarily unavailable. Please type or try another recording.",
      );
    }
    const result = (await response.json()) as { transcript?: string };
    if (!result.transcript?.trim())
      throw new HttpError(
        422,
        "No speech was detected. Please try again or type your answer.",
      );
    return json({ transcript: result.transcript });
  });
}
