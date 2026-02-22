"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";

interface FloatingGlassMenuProps {
    activeTab: string;
    onTabChange: (tab: any) => void;
    tabs: { id: string; label: string; icon: string }[];
}

const TAB_CONFIG: Record<string, { color: string; glow: string }> = {
    home: { color: "#3B82F6", glow: "rgba(59, 130, 246, 0.5)" },    // Blue
    checkin: { color: "#22C55E", glow: "rgba(34, 197, 94, 0.5)" },  // Green
    insights: { color: "#06B6D4", glow: "rgba(6, 182, 212, 0.5)" }, // Cyan
    journal: { color: "#D946EF", glow: "rgba(217, 70, 239, 0.5)" }, // Magenta
    profile: { color: "#F59E0B", glow: "rgba(245, 158, 11, 0.5)" }, // Gold
};

export function FloatingGlassMenu({ activeTab, onTabChange, tabs }: FloatingGlassMenuProps) {
    return (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full flex justify-center pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div
                className="flex items-center gap-1 p-1.5 rounded-[26px] bg-white/[0.08] border border-white/[0.14] border-t-white/20 backdrop-blur-[24px] saturate-[160%] shadow-[0_16px_50px_rgba(0,0,0,0.5)] pointer-events-auto w-[min(94vw,420px)] h-[68px]"
                style={{ WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
            >
                {tabs.map((tab) => {
                    const config = TAB_CONFIG[tab.id] || { color: "#FFFFFF", glow: "rgba(255,255,255,0.3)" };
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={clsx(
                                "relative flex-1 h-full rounded-[18px] text-xs sm:text-sm font-medium transition-all outline-none flex flex-col items-center justify-center gap-0.5 min-h-[44px]",
                                isActive ? "scale-105" : "text-white/40 hover:text-white/70"
                            )}
                            style={{ color: isActive ? config.color : undefined }}
                            aria-label={tab.label}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute inset-0 bg-white/[0.12] border border-white/[0.14] rounded-[18px]"
                                    transition={{ type: "spring", duration: 0.22, bounce: 0, damping: 25, stiffness: 200 }}
                                />
                            )}

                            <span
                                className="relative z-10 text-xl transition-all duration-300"
                                style={{
                                    filter: isActive ? `drop-shadow(0 0 8px ${config.glow})` : "none",
                                    textShadow: isActive ? `0 0 12px ${config.glow}` : "none"
                                }}
                            >
                                {tab.icon}
                            </span>
                            <span className={clsx(
                                "relative z-10 font-bold tracking-tight transition-all duration-300",
                                isActive ? "opacity-100" : "opacity-60"
                            )}>
                                {tab.label}
                            </span>

                            {isActive && (
                                <motion.div
                                    layoutId="active-dot"
                                    className="absolute bottom-1 w-5 h-1 rounded-full shadow-lg"
                                    style={{
                                        backgroundColor: config.color,
                                        boxShadow: `0 0 10px ${config.color}`
                                    }}
                                    transition={{ type: "spring", duration: 0.25 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
