"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Bootstrap } from "./types";
import { api } from "./api";

function useBootstrapState() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void api<Bootstrap>("/api/bootstrap", { signal: controller.signal })
      .then((result) => {
        setData(result);
        const url = new URL(window.location.href);
        if (url.searchParams.has("auth_error")) {
          setError("Google sign-in could not be completed. Please try again.");
          url.searchParams.delete("auth_error");
          window.history.replaceState(null, "", url);
        } else setError("");
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

const BootstrapContext = createContext<ReturnType<
  typeof useBootstrapState
> | null>(null);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const value = useBootstrapState();
  return createElement(BootstrapContext.Provider, { value }, children);
}

export function useBootstrap() {
  const context = useContext(BootstrapContext);
  if (!context) throw new Error("BootstrapProvider is required.");
  return context;
}
