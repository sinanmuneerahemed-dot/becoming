"use client";

import { useEffect, useState, useRef } from "react";

export function AuroraBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isTouch, setIsTouch] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);
  const glowRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const requestRef = useRef<number>();

  useEffect(() => {
    setHasTouch('ontouchstart' in window);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setIsTouch(true);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setIsTouch(true);
      }
    };

    const handleTouchEnd = () => {
      setIsTouch(false);
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const observer = new MutationObserver(() => {
      setIsModalOpen(document.body.style.overflow === "hidden");
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  // Smooth easing for the glow and reactive movement
  useEffect(() => {
    const animate = () => {
      glowRef.current.x += (mousePos.x - glowRef.current.x) * 0.08;
      glowRef.current.y += (mousePos.y - glowRef.current.y) * 0.08;

      const glowElement = document.getElementById("cursor-glow");
      if (glowElement) {
        glowElement.style.transform = `translate(${glowRef.current.x - 250}px, ${glowRef.current.y - 250}px)`;
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mousePos]);

  // Mouse reactive shift values
  const moveX = (mousePos.x / (typeof window !== 'undefined' ? window.innerWidth : 1) - 0.5) * 50;
  const moveY = (mousePos.y / (typeof window !== 'undefined' ? window.innerHeight : 1) - 0.5) * 50;

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden transition-all duration-1000 ${isModalOpen ? "blur-xl scale-110" : ""
        }`}
      aria-hidden
      style={{ backgroundColor: "#0b0f1a" }}
    >
      {/* Dynamic Mesh Blobs */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] opacity-50 blur-[120px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(79, 70, 229, 0.6) 0%, transparent 70%)", // Indigo
          animation: "mesh-1 20s linear infinite",
          transform: `translate(${moveX * 0.5}px, ${moveY * 0.5 + scrollY * 0.1}px)`,
        }}
      />
      <div
        className="absolute top-[10%] right-[-10%] w-[60%] h-[60%] opacity-40 blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(219, 39, 119, 0.5) 0%, transparent 70%)", // Magenta
          animation: "mesh-2 25s linear infinite",
          transform: `translate(${moveX * -0.3}px, ${moveY * -0.3 + scrollY * -0.05}px)`,
        }}
      />
      <div
        className="absolute bottom-[-20%] left-[20%] w-[80%] h-[80%] opacity-35 blur-[130px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(14, 165, 233, 0.5) 0%, transparent 70%)", // Cyan
          animation: "mesh-3 18s ease-in-out infinite",
          transform: `translate(${moveX * 0.2}px, ${moveY * 0.2 + scrollY * 0.08}px)`,
        }}
      />
      <div
        className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] opacity-30 blur-[90px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(124, 58, 237, 0.45) 0%, transparent 70%)", // Violet
          animation: "mesh-1 22s linear infinite reverse",
          transform: `translate(${moveX * -0.4}px, ${moveY * 0.4 - scrollY * 0.02}px)`,
        }}
      />

      {/* Surface Texture / Grain */}
      <div className="absolute inset-0 opacity-[0.2] noise-filter mix-blend-overlay pointer-events-none"
        style={{ animation: 'grain-shift 0.8s steps(10) infinite' }} />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:100px_100px]" />

      {/* Interactive Cursor Glow */}
      <div
        id="cursor-glow"
        className={`fixed top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-opacity duration-500`}
        style={{
          background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.12) 0%, transparent 70%)",
          opacity: isTouch || !hasTouch ? 1 : 0,
          willChange: "transform",
        }}
      />
    </div>
  );
}
