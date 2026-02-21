"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface WeeklyAimStepProps {
    displayName: string;
    onSubmit: (aimText: string) => Promise<void>;
    isSubmitting: boolean;
}

export function WeeklyAimStep({
    displayName,
    onSubmit,
    isSubmitting,
}: WeeklyAimStepProps) {
    const [aimText, setAimText] = useState("");
    const firstName = displayName?.split(" ")[0] ?? displayName;

    function handleSubmit() {
        const trimmed = aimText.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">
                    7-Day Direction
                </p>
                <h2 className="text-xl sm:text-2xl font-bold leading-snug">
                    Hey {firstName}, what is your aim for the next 7 days?
                </h2>
                <p className="text-white/50 text-sm mt-2">
                    One clear aim. Be specific so AI can split it into focused blocks and break guidance.
                </p>
            </div>

            <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-neon-cyan/60 transition-colors"
                rows={4}
                maxLength={200}
                placeholder="e.g. Cover 4 chapters a day / Ship my portfolio page / Sleep by 11 PM"
                value={aimText}
                onChange={(e) => setAimText(e.target.value)}
                disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
                <span className="text-white/30 text-xs">{aimText.length}/200</span>
            </div>

            {isSubmitting && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-2"
                >
                    <p className="text-neon-cyan text-sm animate-pulse">
                        BECOMING is building your flexible 7-day blocks...
                    </p>
                </motion.div>
            )}

            <button
                onClick={handleSubmit}
                disabled={!aimText.trim() || isSubmitting}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all
          bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan
          hover:bg-neon-cyan/20 hover:border-neon-cyan/70
          disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isSubmitting ? "Generating Plan..." : "Set My 7-Day Aim ->"}
            </button>

            <p className="text-white/30 text-xs text-center">
                AI generates flexible block partitions with focus time and break time based on your behavior.
            </p>
        </div>
    );
}
