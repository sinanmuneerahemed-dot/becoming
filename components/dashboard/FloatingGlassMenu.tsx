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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] pointer-events-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={clsx(
                            "relative px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors duration-300 outline-none flex items-center gap-2",
                            activeTab === tab.id ? "text-white" : "text-white/40 hover:text-white/70"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute inset-0 bg-white/10 rounded-full border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                                transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                            />
                        )}
                        <span className="relative z-10 hidden sm:inline">{tab.icon}</span>
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
