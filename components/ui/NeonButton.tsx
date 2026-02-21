"use client";

import { clsx } from "clsx";

interface NeonButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd"> {
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  className?: string;
}

export function NeonButton({
  variant = "primary",
  children,
  className,
  disabled,
  ...props
}: NeonButtonProps) {
  const base =
    "relative px-4 sm:px-6 py-3 min-h-[44px] rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:ring-offset-2 focus:ring-offset-midnight disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] hover:scale-[1.02] motion-reduce:transform-none touch-manipulation";

  const variants = {
    primary:
      "bg-transparent border-2 border-neon-cyan/60 text-neon-cyan hover:border-neon-cyan hover:bg-neon-cyan/10",
    secondary:
      "bg-transparent border-2 border-neon-magenta/60 text-neon-magenta hover:border-neon-magenta hover:bg-neon-magenta/10",
    ghost:
      "border border-white/20 text-white/90 hover:bg-white/5 hover:border-white/30",
  };

  return (
    <button
      type="button"
      className={clsx(base, variants[variant], className)}
      disabled={disabled}
      {...props}
    >
      {variant === "primary" && (
        <span
          className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none -z-10 blur-xl bg-neon-cyan/20 motion-reduce:opacity-0"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
