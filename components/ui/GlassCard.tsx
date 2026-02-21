import { clsx } from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/10 bg-white/5 backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}
