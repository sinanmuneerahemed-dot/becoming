"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { getEntriesForRange, getEntry } from "@/lib/firestore";
import type { Entry } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HistoryView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (!user) return;
    const { start, end } = getDateRange(365);
    getEntriesForRange(user.uid, start, end).then((e) => {
      setEntries(e.sort((a, b) => (b.date > a.date ? 1 : -1)));
      setLoading(false);
    });
  }, [user]);

  const handleView = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (user) {
      getEntry(user.uid, dateStr).then((entry) => setSelectedEntry(entry ?? null));
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-4 sm:p-8 text-center">
        <p className="text-white/60">Loading...</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 sm:p-8">
      <h2 className="text-xl font-bold mb-6">History</h2>
      {selectedEntry ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => { setSelectedEntry(null); setSelectedDate(null); }}
            className="text-sm text-neon-cyan hover:underline"
          >
            Back to list
          </button>
          <div className="border-l-2 border-neon-cyan pl-4">
            <p className="text-white/60 text-sm">{formatDisplayDate(selectedEntry.date)}</p>
            <p className="text-2xl font-bold text-neon-cyan mt-1">{selectedEntry.computed?.score ?? 0}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div><span className="text-white/50">Mood:</span> {selectedEntry.answers.mood || "—"}</div>
              <div><span className="text-white/50">Energy:</span> {selectedEntry.answers.energy || "—"}</div>
              <div><span className="text-white/50">Focus:</span> {selectedEntry.answers.focus || "—"}</div>
              <div><span className="text-white/50">Stress:</span> {selectedEntry.answers.stress || "—"}</div>
              <div><span className="text-white/50">Sleep:</span> {selectedEntry.answers.sleepHours ?? 0} hrs</div>
              <div><span className="text-white/50">Screen time:</span> {selectedEntry.answers.screenTimeHours ?? 0} hrs</div>
              <div className="col-span-2"><span className="text-white/50">Win:</span> {selectedEntry.answers.win || "—"}</div>
              <div className="col-span-2"><span className="text-white/50">Struggle:</span> {selectedEntry.answers.struggle || "—"}</div>
            </div>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-white/40">No entries yet. Start your first check-in!</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              <span className="text-white/80">{formatDisplayDate(e.date)}</span>
              <span className="text-neon-cyan font-mono">{e.computed?.score ?? 0}</span>
              <button
                type="button"
                onClick={() => handleView(e.date)}
                className="text-sm text-neon-cyan hover:underline"
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
