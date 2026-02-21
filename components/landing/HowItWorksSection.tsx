"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

const STEPS = [
  {
    title: "Reflect",
    description:
      "Answer a few questions about your day—screen time, emotions, focus, and sleep.",
  },
  {
    title: "Act",
    description:
      "Identify your wins and distractions. Awareness is the first step to change.",
  },
  {
    title: "Review",
    description:
      "See your trends over 7 and 30 days. Track your streak and score.",
  },
];

export function HowItWorksSection() {
  return (
    <motion.section
      id="how-it-works"
      className="py-16 sm:py-24 px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-16">
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <GlassCard className="p-6 h-full">
                <span className="text-neon-cyan font-mono text-sm">
                  Step {i + 1}
                </span>
                <h3 className="text-xl font-bold mt-2 mb-4">{step.title}</h3>
                <p className="text-white/70">{step.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
