"use client";
/*
 * Reusable async-safety hooks. Every interactive flow routes through these so
 * double-submit, race conditions, and setState-after-unmount are impossible
 * by construction instead of per-handler discipline.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiResult } from "./api";

/* True until the component unmounts — gate for any setState in async tails. */
export function useMountedRef() {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return mounted;
}

/*
 * Wrap an async handler: `run` ignores calls while one is in flight (sync ref
 * guard — closes the double-click window before React state updates), exposes
 * `pending` for disabled/loading UI, and never updates state after unmount.
 */
export function useAsyncAction<A extends unknown[]>(fn: (...args: A) => Promise<void>) {
  const busy = useRef(false);
  const mounted = useMountedRef();
  const [pending, setPending] = useState(false);
  const run = useCallback(async (...args: A) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try { await fn(...args); }
    finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [fn, mounted]);
  return { run, pending };
}

/*
 * Upload with progress, cancel, and retry. Keeps the last file so a failed or
 * cancelled upload can be retried without re-picking. onDone only fires on
 * success while mounted.
 */
export function useUpload(onDone: (file: File) => void) {
  const mounted = useMountedRef();
  const ctrl = useRef<AbortController | null>(null);
  const lastFile = useRef<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const start = useCallback(async (file: File): Promise<ApiResult<{ name: string }>> => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    lastFile.current = file;
    setUploading(true); setProgress(0);
    const res = await api.vault.upload(file, {
      signal: c.signal,
      onProgress: (pct) => { if (mounted.current) setProgress(pct); },
    });
    if (mounted.current) setUploading(false);
    if (res.ok && mounted.current) onDone(file);
    return res;
  }, [onDone, mounted]);

  const cancel = useCallback(() => { ctrl.current?.abort(); }, []);
  const retry = useCallback(() => { if (lastFile.current) void start(lastFile.current); }, [start]);

  useEffect(() => () => ctrl.current?.abort(), []); // abort in-flight upload on unmount

  return { start, cancel, retry, uploading, progress };
}
