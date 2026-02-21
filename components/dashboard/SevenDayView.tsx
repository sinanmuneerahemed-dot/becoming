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
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function SevenDayView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const { start, end } = getDateRange(7);
    Promise.all([
      getEntriesForRange(user.uid, start, end),
      getLastNEntries(user.uid, 31),
    ]).then(([e, lastN]) => {
      setEntries(e);
      setEntryCount(lastN.length);
      setLoading(false);
    }).catch((err) => {
      console.error("Dashboard data load error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
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

  if (error) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Failed to load data: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm text-neon-cyan hover:underline"
        >
          Reload page
        </button>
      </GlassCard>
    );
  }

  const avgScreen = entries.length > 0
    ? (entries.reduce((s, e) => s + (e.answers.screenTimeHours ?? 0), 0) / entries.length).toFixed(1)
    : "—";
  const avgSleep = entries.length > 0
    ? (entries.reduce((s, e) => s + (e.answers.sleepHours ?? 0), 0) / entries.length).toFixed(1)
    : "—";

  const moods = entries.map((e) => e.answers.mood).filter(Boolean) as string[];
  const moodCounts: Record<string, number> = {};
  moods.forEach((m) => { moodCounts[m] = (moodCounts[m] ?? 0) + 1; });
  const mostCommonMood = Object.keys(moodCounts).length > 0
    ? Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0]
    : "—";

  const maxScore = Math.max(...entries.map((e) => e.computed?.score ?? 0), 1);

  return (
    <div className="space-y-6">
      <GlassCard className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-x-auto">
        <h2 className="text-xl font-bold">Last 7 Days</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
          <div><p className="text-white/50 text-sm">Avg Screen Time</p><p className="text-neon-cyan text-xl">{avgScreen} hrs</p></div>
          <div><p className="text-white/50 text-sm">Avg Sleep</p><p className="text-neon-cyan text-xl">{avgSleep} hrs</p></div>
          <div><p className="text-white/50 text-sm">Most Common Mood</p><p className="text-neon-magenta text-xl">{mostCommonMood}</p></div>
        </div>
        <div>
          <p className="text-white/60 text-sm mb-4">Score trend</p>
          <div className="flex items-end gap-0.5 sm:gap-1 h-28 sm:h-32 min-w-0">
            {entries.length === 0 ? (
              <p className="text-white/40 text-sm">No data yet</p>
            ) : (
              entries.map((e) => {
                const score = e.computed?.score ?? 0;
                const height = (score / maxScore) * 100;
                return (
                  <div key={e.id} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-neon-cyan/40 rounded-t min-h-[4px]" style={{ height: `${Math.max(height, 4)}%` }} />
                    <span className="text-[10px] text-white/50 truncate max-w-full">{e.date.slice(5)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </GlassCard>
      <WeeklyInsightsCard entryCount={entryCount} />
      <MonthlyInsightsCard entryCount={entryCount} />
    </div>
  );
}
