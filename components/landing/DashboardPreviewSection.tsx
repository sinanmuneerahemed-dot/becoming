"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

const MOCK_CARDS = [
  { label: "Today", score: "78", streak: "3" },
  { label: "7 Days", score: "72", streak: "—" },
  { label: "30 Days", score: "68", streak: "—" },
];

export function DashboardPreviewSection() {
  return (
    <motion.section
      id="dashboard-preview"
      className="py-16 sm:py-24 px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-16">
          Dashboard preview
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {MOCK_CARDS.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <GlassCard className="p-6 text-center">
                <p className="text-white/60 text-sm mb-2">{card.label}</p>
                <p className="text-3xl font-bold text-neon-cyan">{card.score}</p>
                <p className="text-white/50 text-xs mt-2">
                  Streak: {card.streak}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
