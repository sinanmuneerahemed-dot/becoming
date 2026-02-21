"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { getActiveWeeklyAim } from "@/lib/firestore";
import type { WeeklyAim } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { FullPlanModal } from "./FullPlanModal";

function getDayNumber(startDate: string): number {
    const start = new Date(startDate);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const diff = Math.floor(
        (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.min(Math.max(diff + 1, 1), 7);
}

export function SevenDayDirectionCard() {
    const { user } = useAuth();
    const [aim, setAim] = useState<WeeklyAim | null | undefined>(undefined);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!user) return;
        getActiveWeeklyAim(user.uid)
            .then((a) => setAim(a ?? null))
            .catch(() => setAim(null));
    }, [user]);

    // Loading
    if (aim === undefined) {
        return (
            <GlassCard className="p-4 sm:p-6">
                <p className="text-white/30 text-sm">Loading direction...</p>
            </GlassCard>
        );
    }

    // No active aim
    if (!aim) return null;

    const currentDay = getDayNumber(aim.startDate);
    const todayPlan = aim.days?.find((d) => d.day === currentDay);
    const progress = `${currentDay}/7`;

    return (
        <>
            <GlassCard className="p-4 sm:p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                            Your 7-Day Direction
                        </p>
                        <h3 className="font-bold text-white">{aim.planTitle}</h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan shrink-0">
                        Day {progress}
                    </span>
                </div>

                {/* Aim text */}
                <p className="text-white/60 text-sm italic border-l-2 border-neon-cyan/30 pl-3">
                    &ldquo;{aim.aimText}&rdquo;
                </p>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-neon-cyan/60 rounded-full transition-all duration-500"
                        style={{ width: `${(currentDay / 7) * 100}%` }}
                    />
                </div>

                {/* Today's tasks */}
                {todayPlan ? (
                    <div className="space-y-2">
                        <p className="text-xs text-white/50 uppercase tracking-wider">
                            Today — {todayPlan.focus}
                        </p>
                        <ul className="space-y-1.5">
                            {todayPlan.tasks.slice(0, 3).map((task, i) => (
                                <li key={i} className="flex gap-2 text-sm text-white/80">
                                    <span className="text-neon-cyan/60 shrink-0 mt-0.5">›</span>
                                    <span>{task}</span>
                                </li>
                            ))}
                        </ul>
                        {todayPlan.estimatedTime && (
                            <p className="text-white/30 text-xs">⏱ {todayPlan.estimatedTime}</p>
                        )}
                    </div>
                ) : (
                    <p className="text-white/40 text-sm">No plan data for today.</p>
                )}

                {/* View Full Plan */}
                <button
                    onClick={() => setShowModal(true)}
                    className="text-neon-cyan text-sm hover:underline text-left"
                >
                    View Full Plan →
                </button>
            </GlassCard>

            {showModal && (
                <FullPlanModal
                    aim={aim}
                    currentDay={currentDay}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}
