import { useEffect, useState } from "react";

interface UseAppReadyOptions {
  authLoading: boolean;
  isAuthenticated: boolean;
  listingsSettled: boolean;
  /** Safety timeout (ms) so a broken/slow catalogue request never traps the loader */
  listingsTimeoutMs?: number;
}

/**
 * First-load readiness rule:
 * 1. Auth session restore settled (/auth/me/)
 * 2. If signed in, first listings fetch settled OR 3s timeout elapsed
 * 3. Document fonts ready (or 1.5s fallback)
 */
export function useAppReady({
  authLoading,
  isAuthenticated,
  listingsSettled,
  listingsTimeoutMs = 3000,
}: UseAppReadyOptions): boolean {
  const [fontsReady, setFontsReady] = useState<boolean>(false);
  const [listingsTimedOut, setListingsTimedOut] = useState<boolean>(false);

  // Wait for fonts with a safe fallback
  useEffect(() => {
    let active = true;
    const fallback = window.setTimeout(() => {
      if (active) setFontsReady(true);
    }, 1500);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (active) setFontsReady(true);
      });
    } else {
      setFontsReady(true);
    }

    return () => {
      active = false;
      window.clearTimeout(fallback);
    };
  }, []);

  // 3s safety timeout for the initial listings fetch when signed in
  useEffect(() => {
    if (authLoading || !isAuthenticated || listingsSettled) return;
    const timer = window.setTimeout(() => setListingsTimedOut(true), listingsTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [authLoading, isAuthenticated, listingsSettled, listingsTimeoutMs]);

  const dataReady = !isAuthenticated || listingsSettled || listingsTimedOut;
  return !authLoading && dataReady && fontsReady;
}
