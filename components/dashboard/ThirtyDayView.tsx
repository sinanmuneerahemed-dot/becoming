"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { getEntriesForRange, getLastNEntries } from "@/lib/firestore";
import type { Entry } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { WeeklyInsightsCard } from "./WeeklyInsightsCard";
import { MonthlyInsightsCard } from "./MonthlyInsightsCard";

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function ThirtyDayView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { start, end } = getDateRange(30);
    Promise.all([
      getEntriesForRange(user.uid, start, end),
      getLastNEntries(user.uid, 31),
    ]).then(([e, lastN]) => {
      setEntries(e);
      setEntryCount(lastN.length);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-white/60">Loading...</p>
      </GlassCard>
    );
  }

  const avgScreen =
    entries.length > 0
      ? (
          entries.reduce((s, e) => s + (e.answers.screenTimeHours ?? 0), 0) /
          entries.length
        ).toFixed(1)
      : "—";
  const avgSleep =
    entries.length > 0
      ? (
          entries.reduce((s, e) => s + (e.answers.sleepHours ?? 0), 0) /
          entries.length
        ).toFixed(1)
      : "—";

  const scores = entries.map((e) => e.computed?.score ?? 0);
  const maxScore = Math.max(...scores, 1);

  const points = entries.map((e, i) => {
    const x = (i / Math.max(entries.length - 1, 1)) * 100;
    const y = 100 - ((e.computed?.score ?? 0) / maxScore) * 100;
    return `${x},${y}`;
  });
  const pathD = points.length >= 2 ? `M ${points.join(" L ")}` : "";

  return (
    <div className="space-y-6">
      <GlassCard className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-x-auto">
        <h2 className="text-xl font-bold">Last 30 Days</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-center">
          <div>
            <p className="text-white/50 text-sm">Avg Screen Time</p>
            <p className="text-neon-cyan text-xl">{avgScreen} hrs</p>
          </div>
          <div>
            <p className="text-white/50 text-sm">Avg Sleep</p>
            <p className="text-neon-cyan text-xl">{avgSleep} hrs</p>
          </div>
        </div>
        <div>
          <p className="text-white/60 text-sm mb-4">Score trend</p>
          <div className="h-40 w-full">
            {entries.length < 2 ? (
              <p className="text-white/40 text-sm">Need at least 2 entries</p>
            ) : (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00f5ff" />
                    <stop offset="100%" stopColor="#ff00ff" />
                  </linearGradient>
                </defs>
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      </GlassCard>
      <WeeklyInsightsCard entryCount={entryCount} />
      <MonthlyInsightsCard entryCount={entryCount} />
    </div>
  );
}
