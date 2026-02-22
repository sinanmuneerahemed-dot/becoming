"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeeklyAim } from "@/lib/firestore";

interface FullPlanModalProps {
    aim: WeeklyAim;
    currentDay: number;
    onClose: () => void;
}

type BlockType = "action" | "break" | "review" | "other";

function classifyBlock(line: string): BlockType {
    const l = line.toLowerCase();
    const startsAsBreak = /^\s*(break|rest)\b/.test(l);
    const hasFocusMarker = /\bfocus\b/.test(l);
    const hasStructuredBlock = /^block\s*\d+/i.test(line);

    if (
        startsAsBreak ||
        (
            !hasFocusMarker &&
            !hasStructuredBlock &&
            (
                l.includes("break") ||
                l.includes("stretch") ||
                l.includes("water") ||
                l.includes("breathe") ||
                l.includes("walk")
            )
        )
    ) {
        return "break";
    }

    if (l.includes("review") || l.includes("consolidate") || l.includes("reflect")) {
        return "review";
    }

    if (
        l.includes("study") ||
        l.includes("session") ||
        l.includes("work") ||
        l.includes("read") ||
        l.includes("practice") ||
        l.includes("solve") ||
        l.includes("write") ||
        l.includes("run") ||
        l.includes("workout") ||
        l.includes("exercise") ||
        l.includes("build") ||
        l.includes("ship") ||
        l.includes("code") ||
        l.includes("meal") ||
        hasFocusMarker ||
        hasStructuredBlock
    ) {
        return "action";
    }

    return "other";
}

const blockStyles: Record<BlockType, string> = {
    action: "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan",
    break: "bg-white/5 border-white/10 text-white/50",
    review: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    other: "bg-white/5 border-white/10 text-white/60",
};

const blockIcons: Record<BlockType, string> = {
    action: ">",
    break: "~",
    review: "*",
    other: "-",
};

export function FullPlanModal({ aim, currentDay, onClose }: FullPlanModalProps) {
    const [openDay, setOpenDay] = useState<number>(currentDay);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-6"
                style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 40 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0c] p-6 sm:p-8 space-y-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-neon-cyan uppercase tracking-[0.2em]">Goal Intelligence Engine</p>
                            <h2 className="text-2xl font-bold tracking-tight text-white">{aim.planTitle}</h2>
                            <p className="text-white/40 text-sm italic font-medium">&ldquo;{aim.aimText}&rdquo;</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Intelligence Sections */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {aim.goalInterpretation && (
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-neon-cyan">
                                    <span className="text-lg">🎯</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Interpretation</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-medium">{aim.goalInterpretation}</p>
                            </div>
                        )}
                        {aim.strategicBreakdown && (
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-purple-400">
                                    <span className="text-lg">🧠</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Strategy</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-medium">{aim.strategicBreakdown}</p>
                            </div>
                        )}
                        {aim.expectedOutcome && (
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-green-400">
                                    <span className="text-lg">📊</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Expected Outcome</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-medium">{aim.expectedOutcome}</p>
                            </div>
                        )}
                        {aim.riskAdvice && (
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-red-400">
                                    <span className="text-lg">⚠️</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Risks & Correction</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-medium">{aim.riskAdvice}</p>
                            </div>
                        )}
                    </div>

                    {/* Behavioral Insights */}
                    {aim.behavioralInsights && aim.behavioralInsights.length > 0 && (
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-orange-500/10 space-y-3">
                            <div className="flex items-center gap-2 text-orange-400">
                                <span className="text-lg">🔥</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Behavioral Insights</span>
                            </div>
                            <ul className="space-y-2">
                                {aim.behavioralInsights.map((insight, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-white/80 font-medium">
                                        <span className="text-orange-500/40 shrink-0">•</span>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="h-px bg-white/5" />

                    {/* 7-Day Plan Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">7-Day Execution Path</p>
                            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                {aim.days.map((d) => {
                                    const isToday = d.day === currentDay;
                                    const isPast = d.day < currentDay;
                                    return (
                                        <button
                                            key={d.day}
                                            onClick={() => setOpenDay(d.day)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${openDay === d.day
                                                ? isToday
                                                    ? "bg-neon-cyan border-neon-cyan text-black"
                                                    : "bg-white border-white text-black"
                                                : isToday
                                                    ? "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan"
                                                    : isPast
                                                        ? "bg-white/5 border-white/10 text-white/20"
                                                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                                                }`}
                                        >
                                            D{d.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {aim.days.map((dayPlan) => {
                            if (openDay !== dayPlan.day) return null;
                            const isToday = dayPlan.day === currentDay;
                            const isPast = dayPlan.day < currentDay;

                            return (
                                <motion.div
                                    key={dayPlan.day}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`text-3xl font-black italic tracking-tighter ${isToday ? "text-neon-cyan" : "text-white/10"}`}>
                                            DAY {dayPlan.day}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                {isToday && <span className="text-[10px] bg-neon-cyan/20 text-neon-cyan px-2 py-0.5 rounded-full border border-neon-cyan/30 font-bold uppercase tracking-widest">Today</span>}
                                                <span className="text-white font-bold tracking-tight">{dayPlan.focus}</span>
                                            </div>
                                            {dayPlan.estimatedTime && (
                                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Active Window: {dayPlan.estimatedTime}</p>
                                            )}
                                        </div>
                                    </div>

                                    {dayPlan.tasks.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Core Deliverables</p>
                                            <div className="space-y-2">
                                                {dayPlan.tasks.map((task, i) => (
                                                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors group">
                                                        <div className="w-5 h-5 rounded-full border border-neon-cyan/30 flex items-center justify-center text-[10px] text-neon-cyan shrink-0 mt-0.5 group-hover:bg-neon-cyan group-hover:text-black transition-colors">
                                                            {i + 1}
                                                        </div>
                                                        <span className="text-white/80 text-sm font-medium leading-relaxed">{task}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {dayPlan.schedule && dayPlan.schedule.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Flexible Blocks</p>
                                            <div className="space-y-2">
                                                {dayPlan.schedule.map((line, i) => {
                                                    const type = classifyBlock(line);
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`flex gap-3 items-center px-4 py-3 rounded-xl border text-sm font-medium transition-all ${blockStyles[type]}`}
                                                        >
                                                            <span className="shrink-0 text-lg opacity-70">{blockIcons[type]}</span>
                                                            <span className="truncate">{line}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Checkpoints & Recovery */}
                    <div className="p-6 rounded-3xl bg-purple-500/[0.03] border border-purple-500/10 space-y-4">
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Stability & Recovery</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Checkpoint Day 3</p>
                                <p className="text-sm text-white/60 leading-relaxed font-medium italic">
                                    {aim.checkpoints?.day3 ?? "Evaluate initial momentum and adjust workload if needed."}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Checkpoint Day 7</p>
                                <p className="text-sm text-white/60 leading-relaxed font-medium italic">
                                    {aim.checkpoints?.day7 ?? "Final review of deliverables and sustainability check."}
                                </p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">If You Miss a Day</p>
                            <p className="text-sm text-white/60 leading-relaxed font-medium">
                                {aim.ifYouMissDay ?? "Do not let one missed day derail your week. Complete exactly 50% of today's core tasks and return to full schedule tomorrow."}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl text-sm font-bold text-white/30 border border-white/5 hover:bg-white/5 hover:text-white transition-all uppercase tracking-widest"
                    >
                        Close Engine
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
