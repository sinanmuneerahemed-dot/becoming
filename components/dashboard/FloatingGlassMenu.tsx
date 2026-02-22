"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";

interface FloatingGlassMenuProps {
    activeTab: string;
    onTabChange: (tab: any) => void;
    tabs: { id: string; label: string; icon: string }[];
}

export function FloatingGlassMenu({ activeTab, onTabChange, tabs }: FloatingGlassMenuProps) {
    return (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full flex justify-center pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div
                className="flex items-center gap-1 p-1.5 rounded-[26px] bg-white/[0.10] border border-white/[0.16] backdrop-blur-[24px] saturate-[160%] shadow-[0_16px_50px_rgba(0,0,0,0.45)] pointer-events-auto w-[min(92vw,420px)] h-[64px]"
                style={{ WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={clsx(
                            "relative flex-1 h-full rounded-[18px] text-xs sm:text-sm font-medium transition-all outline-none flex flex-col items-center justify-center gap-0.5 min-h-[44px]",
                            activeTab === tab.id ? "text-white scale-105" : "text-white/40 hover:text-white/70"
                        )}
                        aria-label={tab.label}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute inset-0 bg-white/[0.12] border border-white/[0.14] rounded-[18px]"
                                transition={{ type: "spring", duration: 0.22, bounce: 0, damping: 25, stiffness: 200 }}
                            />
                        )}

                        <span className="relative z-10 text-lg">{tab.icon}</span>
                        <span className="relative z-10 font-bold tracking-tight">{tab.label}</span>

                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-dot"
                                className="absolute bottom-1.5 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
