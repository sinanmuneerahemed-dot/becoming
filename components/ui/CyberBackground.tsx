"use client";

import { useEffect, useState, useRef } from "react";

export function AuroraBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isTouch, setIsTouch] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const glowRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const requestRef = useRef<number>();

  useEffect(() => {
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

    // Detect if a modal is open (using a simple check for overflow: hidden on body)
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

  // Smooth easing for the glow
  useEffect(() => {
    const animate = () => {
      glowRef.current.x += (mousePos.x - glowRef.current.x) * 0.1;
      glowRef.current.y += (mousePos.y - glowRef.current.y) * 0.1;

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

  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    setHasTouch('ontouchstart' in window);
  }, []);

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden transition-all duration-1000 ${isModalOpen ? "blur-md scale-105" : ""
        }`}
      aria-hidden
      style={{ backgroundColor: "#0b0f1a" }}
    >
      {/* Aurora Blobs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] opacity-40 blur-[120px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(64, 92, 255, 0.45) 0%, transparent 70%)",
          animation: "aurora-1 18s ease-in-out infinite",
          transform: `translateY(${scrollY * 0.05}px)`,
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[70%] h-[70%] opacity-30 blur-[120px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
          animation: "aurora-2 15s ease-in-out infinite",
          transform: `translateY(${-scrollY * 0.03}px)`,
        }}
      />
      <div
        className="absolute top-[20%] right-[10%] w-[60%] h-[60%] opacity-20 blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(34, 211, 238, 0.35) 0%, transparent 70%)",
          animation: "aurora-3 12s ease-in-out infinite",
          transform: `translateY(${scrollY * 0.02}px)`,
        }}
      />

      {/* Surface Texture */}
      <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:100px_100px]" />

      {/* Interactive Cursor Glow */}
      <div
        id="cursor-glow"
        className={`fixed top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-opacity duration-500`}
        style={{
          background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.08) 0%, transparent 70%)",
          opacity: isTouch || !hasTouch ? 1 : 0,
          willChange: "transform",
        }}
      />
    </div>
  );
}
