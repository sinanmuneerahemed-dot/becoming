"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { getOrComputeMonthlyInsights } from "@/lib/insights-service";
import type { MonthlyInsight } from "@/lib/insights-service";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

interface MonthlyInsightsCardProps {
  entryCount: number;
}

export function MonthlyInsightsCard({ entryCount }: MonthlyInsightsCardProps) {
  const { user } = useAuth();
  const [insight, setInsight] = useState<MonthlyInsight | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || entryCount < 30) {
      setInsight(entryCount < 30 ? null : undefined);
      return;
    }
    setError(null);
    getOrComputeMonthlyInsights(user.uid)
      .then(setInsight)
      .catch((err) => {
        console.error("Monthly insight error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setInsight(null);
      });
  }, [user, entryCount]);

  return (
    <GlassCard className="p-4 sm:p-8 space-y-4">
      <h2 className="text-xl font-bold">Monthly Insights</h2>

      {entryCount < 30 ? (
        <div className="space-y-3">
          <p className="text-white/70 text-sm font-mono">{entryCount}/30</p>
          <p className="text-white/60 text-sm">
            Complete {30 - entryCount} more {30 - entryCount === 1 ? "day" : "days"} to unlock Monthly Insights
          </p>
          <Link href="/checkin/1">
            <NeonButton variant="primary" className="mt-2">Add today&apos;s check-in</NeonButton>
          </Link>
        </div>
      ) : insight === undefined ? (
        <p className="text-white/60 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">Error: {error}</p>
      ) : insight === null ? (
        <p className="text-white/60 text-sm">No insights yet.</p>
      ) : (
        <>
          <p className="text-white/50 text-sm">
            {formatDateRange(insight.windowStart, insight.windowEnd)}
          </p>
          {insight.suggestions.length > 0 && (
            <ul className="space-y-2">
              {insight.suggestions.map((s, i) => (
                <li key={i} className="text-white/80 text-sm flex gap-2">
                  <span className="text-neon-cyan shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-l-2 border-neon-magenta/50 pl-4 mt-2">
            <p className="text-white/70 text-sm whitespace-pre-line">{insight.note}</p>
          </div>
        </>
      )}
    </GlassCard>
  );
}
