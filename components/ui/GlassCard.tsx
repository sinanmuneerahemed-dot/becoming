import { clsx } from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/12 bg-white/6 backdrop-blur-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
        className
      )}
    >
      {children}
    </div>
  );
}
