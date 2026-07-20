"use client";
import React, { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const { ten, isHydrated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !ten) {
      router.replace("/login");
    }
  }, [isHydrated, ten, router]);

  if (!isHydrated || !ten) return null;

  return <AppShell>{children}</AppShell>;
}
