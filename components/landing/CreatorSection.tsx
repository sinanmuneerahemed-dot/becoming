"use client";

import { motion } from "framer-motion";

export function CreatorSection() {
  return (
    <motion.section
      id="creator"
      className="py-16 sm:py-24 px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-white/60">
          Made by <span className="text-neon-cyan font-medium">Sinan Muneer Ahmed</span>
        </p>
      </div>
    </motion.section>
  );
}
