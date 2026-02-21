"use client";

export function CyberBackground() {
  const noiseDataUri = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E`;

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Base midnight gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0d0a1a 70%, #0a0a1a 100%)",
        }}
      />
      {/* Animated grid - respects prefers-reduced-motion via motion-safe */}
      <div
        className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(0,245,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,0.5)_1px,transparent_1px)] [background-size:40px_40px] motion-safe:animate-grid-drift"
        style={{
          backgroundPosition: "0 0",
        }}
      />
      {/* Soft neon blobs */}
      <div
        className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none motion-safe:animate-pulse"
        style={{
          background: "radial-gradient(circle, #00f5ff 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/2 -right-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] pointer-events-none motion-safe:animate-pulse"
        style={{
          background: "radial-gradient(circle, #ff00ff 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-1/4 left-1/2 w-[400px] h-[400px] rounded-full opacity-10 blur-[80px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #00f5ff 0%, transparent 70%)",
        }}
      />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url("${noiseDataUri}")`,
        }}
      />
    </div>
  );
}
