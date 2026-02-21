"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { NeonButton } from "@/components/ui/NeonButton";
import { NeonPill } from "@/components/ui/NeonPill";
import { TodayView } from "./TodayView";
import { SevenDayView } from "./SevenDayView";
import { ThirtyDayView } from "./ThirtyDayView";
import { HistoryView } from "./HistoryView";

type Tab = "today" | "7days" | "30days" | "history";

export function DashboardShell() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="min-w-0 flex items-center gap-3">
            <Link href="/">
              <img src="/logo.png" alt="Becoming" className="h-8 w-auto" />
            </Link>
            <div>
            <h1 className="text-xl sm:text-2xl font-bold truncate">Dashboard</h1>
            <p className="text-white/60 text-sm mt-1 truncate">{user?.displayName ?? user?.email ?? "User"}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            <Link href="/checkin/1" className="w-full sm:w-auto">
              <NeonButton variant="primary" className="w-full sm:w-auto justify-center">Start Check-in</NeonButton>
            </Link>
            <NeonButton variant="ghost" onClick={() => signOut()} className="w-full sm:w-auto justify-center">Sign out</NeonButton>
          </div>
        </header>
        <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
          <NeonPill active={tab === "today"} onClick={() => setTab("today")}>Today</NeonPill>
          <NeonPill active={tab === "7days"} onClick={() => setTab("7days")}>7 Days</NeonPill>
          <NeonPill active={tab === "30days"} onClick={() => setTab("30days")}>30 Days</NeonPill>
          <NeonPill active={tab === "history"} onClick={() => setTab("history")}>History</NeonPill>
        </div>
        <div className="min-h-[400px]">
          {tab === "today" && <TodayView />}
          {tab === "7days" && <SevenDayView />}
          {tab === "30days" && <ThirtyDayView />}
          {tab === "history" && <HistoryView />}
        </div>
      </div>
    </div>
  );
}
