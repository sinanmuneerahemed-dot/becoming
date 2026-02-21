"use client";

import { clsx } from "clsx";

interface NeonPillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function NeonPill({ active, onClick, children, className }: NeonPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:ring-offset-2 focus:ring-offset-midnight touch-manipulation",
        active
          ? "bg-neon-cyan/10 border-2 border-neon-cyan text-neon-cyan"
          : "border border-white/20 text-white/70 hover:border-white/40 hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
