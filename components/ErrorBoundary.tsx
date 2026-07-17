"use client";
import React from "react";

/*
 * Per-view error boundary: a render crash in one module degrades to a contained
 * notice instead of white-screening the whole shell. Reset re-mounts children.
 * Uses only existing design classes (.note / .btn) — zero new visual language.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // PROD: send to observability sink (Sentry/Logflare) with tenant + view context
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="note" role="alert">
          <b>Terjadi galat pada modul ini.</b> Data Anda aman — galat tercatat pada jejak audit.{" "}
          <button className="btn btn-line btn-sm" style={{ marginLeft: 8 }} onClick={() => this.setState({ error: null })}>
            Muat ulang modul
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
