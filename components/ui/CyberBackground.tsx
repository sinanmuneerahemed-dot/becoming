"use client";

import { useEffect, useState } from "react";

export function AuroraBackground() {
  const [scrollY, setScrollY] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const observer = new MutationObserver(() => {
      setIsModalOpen(document.body.style.overflow === "hidden");
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden transition-all duration-1000 ${isModalOpen ? "blur-xl scale-110" : ""
        }`}
      aria-hidden
      style={{ backgroundColor: "#0b0f1a" }}
    >
      {/* Dynamic Mesh Blobs - Static Image Match */}
      <div
        className="absolute top-[-15%] left-[-5%] w-[90%] h-[60%] opacity-60 blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.6) 0%, transparent 75%)", // Toxic Green
          transform: `rotate(-15deg) translateY(${scrollY * 0.08}px)`,
        }}
      />
      <div
        className="absolute top-[10%] right-[-10%] w-[80%] h-[70%] opacity-50 blur-[110px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(6, 182, 212, 0.55) 0%, transparent 75%)", // Electric Cyan
          transform: `rotate(-20deg) translateY(${scrollY * -0.05}px)`,
        }}
      />
      <div
        className="absolute bottom-[-15%] left-[10%] w-[85%] h-[65%] opacity-45 blur-[120px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.5) 0%, transparent 75%)", // Royal Blue
          transform: `rotate(-10deg) translateY(${scrollY * 0.06}px)`,
        }}
      />
      <div
        className="absolute top-[30%] left-[20%] w-[60%] h-[40%] opacity-35 blur-[90px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(16, 185, 129, 0.4) 0%, transparent 70%)", // Emerald Green Highlight
          transform: `rotate(-25deg) translateY(${-scrollY * 0.03}px)`,
        }}
      />

      {/* Surface Texture / Grain */}
      <div className="absolute inset-0 opacity-[0.25] noise-filter mix-blend-overlay pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:120px_120px]" />
    </div>
  );
}
