import { requestError } from "@/i18n/translate";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  }).catch((error: unknown) => {
    if (init?.signal?.aborted) throw error;
    throw new Error("The request could not be completed. Please try again.");
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(requestError(result.error, response.status));
  return result;
}
