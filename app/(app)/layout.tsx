"use client";
/* Layout semua halaman ber-login (di luar /hr yang punya layout sendiri).
 * Guard sesi + AppShell + ErrorBoundary per-route. */
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ten, isHydrated } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrated && !ten) router.replace("/login");
  }, [isHydrated, ten, router]);

  if (!isHydrated || !ten) return null;

  return (
    <AppShell>
      <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
    </AppShell>
  );
}
