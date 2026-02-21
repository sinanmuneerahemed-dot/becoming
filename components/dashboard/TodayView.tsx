"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { getEntry, getLastNEntries } from "@/lib/firestore";
import type { Entry } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { WeeklyInsightsCard } from "./WeeklyInsightsCard";
import { MonthlyInsightsCard } from "./MonthlyInsightsCard";
import { SevenDayDirectionCard } from "./SevenDayDirectionCard";

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMirrorSummary(entry: Entry): string {
  const { answers, computed } = entry;
  const mood = answers.mood || "Good";
  const focus = answers.focus || "Normal";
  const score = computed?.score ?? 0;

  if (score >= 80) {
    return `Strong day. ${focus} focus and "${mood}" mood show you're on track.`;
  }
  if (score >= 60) {
    return `Solid progress. ${mood} with ${focus} focus—small steps add up.`;
  }
  return `Every day is a chance to reset. Your "${mood}" and ${focus} focus are data points, not destiny.`;
}

export function TodayView() {
  const { user } = useAuth();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [entryCount, setEntryCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getEntry(user.uid, getTodayDateStr()),
      getLastNEntries(user.uid, 31),
    ]).then(([e, lastN]) => {
      setEntry(e ?? null);
      setEntryCount(lastN.length);
    });
  }, [user]);

  if (entry === undefined) {
    return (
      <GlassCard className="p-4 sm:p-8 text-center">
        <p className="text-white/60">Loading...</p>
      </GlassCard>
    );
  }

  const todayCard = !entry ? (
    <GlassCard className="p-4 sm:p-8 text-center">
      <p className="text-white/80 mb-6">No check-in for today yet.</p>
      <Link href="/checkin/1">
        <NeonButton variant="primary">Start Today&apos;s Check-in</NeonButton>
      </Link>
    </GlassCard>
  ) : (
    <GlassCard className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Today</h2>
        <span className="text-3xl font-bold text-neon-cyan">
          {entry.computed?.score ?? 0}
        </span>
      </div>
      <p className="text-white/80 text-sm italic border-l-2 border-neon-cyan pl-4">
        {getMirrorSummary(entry)}
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-white/50">Mood</span>
          <p className="text-white">{entry.answers.mood || "—"}</p>
        </div>
        <div>
          <span className="text-white/50">Energy</span>
          <p className="text-white">{entry.answers.energy || "—"}</p>
        </div>
        <div>
          <span className="text-white/50">Focus</span>
          <p className="text-white">{entry.answers.focus || "—"}</p>
        </div>
        <div>
          <span className="text-white/50">Stress</span>
          <p className="text-white">{entry.answers.stress || "—"}</p>
        </div>
        <div>
          <span className="text-white/50">Sleep</span>
          <p className="text-white">{entry.answers.sleepHours ?? 0} hrs</p>
        </div>
        <div>
          <span className="text-white/50">Screen time</span>
          <p className="text-white">{entry.answers.screenTimeHours ?? 0} hrs</p>
        </div>
        <div className="col-span-2">
          <span className="text-white/50">Win</span>
          <p className="text-white">{entry.answers.win || "—"}</p>
        </div>
        <div className="col-span-2">
          <span className="text-white/50">Struggle</span>
          <p className="text-white">{entry.answers.struggle || "—"}</p>
        </div>
      </div>
      <Link href="/checkin/1">
        <NeonButton variant="ghost" className="mt-4">
          Edit today&apos;s check-in
        </NeonButton>
      </Link>
    </GlassCard>
  );

  return (
    <div className="space-y-6">
      {todayCard}
      <SevenDayDirectionCard />
      <WeeklyInsightsCard entryCount={entryCount} />
      <MonthlyInsightsCard entryCount={entryCount} />
    </div>
  );
}
