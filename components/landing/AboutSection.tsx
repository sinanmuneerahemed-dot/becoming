"use client";

import { motion } from "framer-motion";

export function AboutSection() {
  return (
    <motion.section
      id="about"
      className="py-16 sm:py-24 px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">About BECOMING</h2>
        <p className="text-lg text-white/80 leading-relaxed">
          BECOMING is a daily reflection app that helps you track your habits,
          emotions, and growth. Spend a few minutes each day answering simple
          questions—screen time, focus, sleep, wins, and distractions—and watch
          your patterns emerge over time.
        </p>
      </div>
    </motion.section>
  );
}
