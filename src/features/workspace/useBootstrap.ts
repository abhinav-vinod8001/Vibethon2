"use client";

import { useEffect, useState } from "react";
import type { Bootstrap } from "./types";
import { api } from "./api";

export function useBootstrap() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void api<Bootstrap>("/api/bootstrap", { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function reload() {
    try {
      const result = await api<Bootstrap>("/api/bootstrap");
      setData(result);
      setError("");
      return result;
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, setError, reload };
}
