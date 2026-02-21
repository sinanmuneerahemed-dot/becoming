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
                style={{ backgroundColor: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)" }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ duration: 0.25 }}
                    className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0a0a0c] p-5 sm:p-7 space-y-5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">7-Day Direction</p>
                            <h2 className="text-lg font-bold">{aim.planTitle}</h2>
                            <p className="text-white/40 text-sm mt-0.5 italic">&ldquo;{aim.aimText}&rdquo;</p>
                        </div>
                        <button onClick={onClose} className="text-white/30 hover:text-white text-xl shrink-0">
                            x
                        </button>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                        {aim.days.map((d) => {
                            const isToday = d.day === currentDay;
                            const isPast = d.day < currentDay;
                            return (
                                <button
                                    key={d.day}
                                    onClick={() => setOpenDay(openDay === d.day ? -1 : d.day)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${openDay === d.day
                                        ? isToday
                                            ? "bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan"
                                            : "bg-white/10 border-white/20 text-white"
                                        : isToday
                                            ? "bg-neon-cyan/5 border-neon-cyan/25 text-neon-cyan/70"
                                            : isPast
                                                ? "bg-white/3 border-white/8 text-white/25"
                                                : "bg-white/5 border-white/10 text-white/50"
                                        }`}
                                >
                                    Day {d.day}
                                    {isToday && <span className="ml-1 text-[10px]">*</span>}
                                </button>
                            );
                        })}
                    </div>

                    {aim.days.map((dayPlan) => {
                        if (openDay !== dayPlan.day) return null;
                        const isToday = dayPlan.day === currentDay;
                        const isPast = dayPlan.day < currentDay;

                        return (
                            <motion.div
                                key={dayPlan.day}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-neon-cyan" : isPast ? "text-white/30" : "text-white/50"}`}>
                                        Day {dayPlan.day}
                                    </span>
                                    {isToday && <span className="text-xs bg-neon-cyan/15 text-neon-cyan px-2 py-0.5 rounded-full border border-neon-cyan/30">Today</span>}
                                    {isPast && <span className="text-xs text-white/25">Past</span>}
                                    <span className="text-white/60 text-sm font-medium">{dayPlan.focus}</span>
                                </div>

                                {dayPlan.estimatedTime && (
                                    <div className="flex gap-4 text-xs text-white/40">
                                        <span>Time: {dayPlan.estimatedTime}</span>
                                    </div>
                                )}

                                {dayPlan.schedule && dayPlan.schedule.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-white/30 uppercase tracking-wider">Flexible Blocks</p>
                                        <div className="space-y-1.5">
                                            {dayPlan.schedule.map((line, i) => {
                                                const type = classifyBlock(line);
                                                const timePart = line.match(/^(\d{1,2}:\d{2}\s*[\-\u2013\u2014]\s*\d{1,2}:\d{2})/)?.[1] ?? "";
                                                const rest = timePart
                                                    ? line.slice(timePart.length).replace(/^\s*[\-\u2013\u2014]\s*/, "")
                                                    : line;

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`flex gap-3 items-start px-3 py-2 rounded-lg border text-sm ${blockStyles[type]}`}
                                                    >
                                                        <span className="shrink-0 text-base leading-tight">{blockIcons[type]}</span>
                                                        <div className="min-w-0">
                                                            {timePart && (
                                                                <span className="text-[10px] font-mono opacity-60 block mb-0.5">{timePart}</span>
                                                            )}
                                                            <span>{rest}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {dayPlan.tasks.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-white/30 uppercase tracking-wider">Key Deliverables</p>
                                        <ul className="space-y-1.5">
                                            {dayPlan.tasks.map((task, i) => (
                                                <li key={i} className="flex gap-2 text-sm text-white/70">
                                                    <span className="text-neon-cyan/50 shrink-0 mt-0.5">&gt;</span>
                                                    <span>{task}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}

                    {aim.planRaw && (() => {
                        const blocks: { heading: string; body: string }[] = [];
                        const lines = aim.planRaw.split("\n");
                        let currentHeading = "";
                        let currentBody: string[] = [];

                        lines.forEach((line) => {
                            if (line.match(/^(Checkpoint|If You Miss)/i)) {
                                if (currentHeading) {
                                    blocks.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
                                }
                                currentHeading = line;
                                currentBody = [];
                            } else if (currentHeading) {
                                currentBody.push(line);
                            }
                        });

                        if (currentHeading) {
                            blocks.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
                        }

                        if (blocks.length === 0) return null;
                        return (
                            <div className="border-t border-white/8 pt-4 space-y-3">
                                <p className="text-xs text-white/30 uppercase tracking-wider">Checkpoints &amp; Recovery</p>
                                {blocks.map((b, i) => (
                                    <div key={i} className="space-y-1">
                                        <p className="text-xs font-semibold text-white/50">{b.heading}</p>
                                        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{b.body}</p>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl text-sm text-white/30 border border-white/8 hover:bg-white/5 transition-colors"
                    >
                        Close
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
