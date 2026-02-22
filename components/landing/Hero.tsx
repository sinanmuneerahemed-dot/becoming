"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { NeonButton } from "@/components/ui/NeonButton";

const LINES = [
  "Reflect on your day.",
  "Act with intention.",
  "Review and grow.",
];

export function Hero() {
  const [lineIndex, setLineIndex] = useState(0);
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const t = setInterval(() => {
      setLineIndex((i) => (i + 1) % LINES.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="min-h-[70vh] sm:min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 sm:py-0 text-center">
      <motion.div
        className="mb-6 sm:mb-8 overflow-hidden flex flex-col items-center gap-4"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[0.1em] sm:tracking-[0.2em]">BECOMING</h1>
      </motion.div>
      <div className="min-h-12 flex items-center justify-center mb-8 sm:mb-12 px-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
            className="text-lg sm:text-xl md:text-2xl text-white/90 text-center"
          >
            {LINES[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
      <motion.span
        className="block h-0.5 w-32 sm:w-48 mx-auto mb-8 sm:mb-12 rounded-full bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-80"
        animate={shouldReduceMotion ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <Link href={user ? "/app" : "/signin"}>
        <NeonButton variant="primary" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 min-h-[44px]">
          Start
        </NeonButton>
      </Link>
    </section>
  );
}
