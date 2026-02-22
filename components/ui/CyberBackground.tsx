"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function AuroraBackground() {
  const [scrollY, setScrollY] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
      className={`fixed inset-0 -z-10 transition-all duration-1000 ${isModalOpen ? "blur-xl scale-110" : ""
        }`}
      aria-hidden
      style={{
        background: "linear-gradient(to bottom, #05070E, #0B1020)",
      }}
    >
      {/* Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.4)]" />

      {/* Aurora Wave Container */}
      <div className="absolute inset-0 overflow-hidden opacity-40">

        {/* Wave 1 - Electric Blue */}
        <div
          className="absolute top-[20%] left-[-50%] w-[200%] h-[60%] blur-[120px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(79, 140, 255, 0.4) 0%, transparent 70%)",
            animation: shouldReduceMotion ? "none" : "aurora-drift-slow 30s linear infinite",
            transform: `translateY(${scrollY * 0.05}px)`,
          }}
        />

        {/* Wave 2 - Soft Violet */}
        <div
          className="absolute top-[30%] left-[-50%] w-[200%] h-[50%] blur-[100px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(124, 77, 255, 0.35) 0%, transparent 65%)",
            animation: shouldReduceMotion ? "none" : "aurora-drift-fast 25s linear infinite reverse",
            transform: `translateY(${scrollY * -0.03}px)`,
          }}
        />

        {/* Wave 3 - Subtle Cyan */}
        <div
          className="absolute top-[25%] left-[-50%] w-[200%] h-[55%] blur-[110px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(49, 209, 255, 0.3) 0%, transparent 70%)",
            animation: shouldReduceMotion ? "none" : "aurora-drift-medium 35s linear infinite",
            transform: `translateY(${scrollY * 0.02}px)`,
          }}
        />
      </div>

      {/* Surface Reflection Glow (Bottom Center) */}
      <div
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-gradient-to-t from-white/5 to-transparent blur-[80px] pointer-events-none opacity-[0.08]"
      />

      <style jsx global>{`
        @keyframes aurora-drift-slow {
          0% { transform: translateX(0); }
          50% { transform: translateX(15%); }
          100% { transform: translateX(0); }
        }
        @keyframes aurora-drift-medium {
          0% { transform: translateX(10%); }
          50% { transform: translateX(-5%); }
          100% { transform: translateX(10%); }
        }
        @keyframes aurora-drift-fast {
          0% { transform: translateX(-15%); }
          50% { transform: translateX(5%); }
          100% { transform: translateX(-15%); }
        }
      `}</style>
    </div>
  );
}
