"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AuthScreen } from "@/components/AuthScreen";
import { Toasts } from "@/components/shell";

export default function LoginPage() {
  const { ten, isHydrated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && ten) {
      router.replace("/beranda");
    }
  }, [isHydrated, ten, router]);

  // Optionally show nothing or a loading spinner while hydrating
  if (!isHydrated || ten) return null;

  return (
    <>
      <AuthScreen />
      <Toasts />
    </>
  );
}
