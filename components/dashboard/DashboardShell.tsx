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
import { FloatingGlassMenu } from "./FloatingGlassMenu";

type Tab = "today" | "7days" | "30days" | "history";

const TABS = [
  { id: "today", label: "Today", icon: "☀️" },
  { id: "7days", label: "Last 7 Days", icon: "📊" },
  { id: "30days", label: "Monthly", icon: "📅" },
  { id: "history", label: "History", icon: "📜" },
];

export function DashboardShell() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 sm:mb-12">
          <div className="min-w-0 flex items-center gap-3">
            <Link href="/">
              <div className="w-1.5 h-8 bg-neon-cyan/50 rounded-full" /> {/* Minimalist Accent */}
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

        <div className="min-h-[400px]">
          {tab === "today" && <TodayView />}
          {tab === "7days" && <SevenDayView />}
          {tab === "30days" && <ThirtyDayView />}
          {tab === "history" && <HistoryView />}
        </div>
      </div>

      <FloatingGlassMenu
        activeTab={tab}
        onTabChange={setTab}
        tabs={TABS}
      />
    </div>
  );
}
