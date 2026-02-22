"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { getEntry, saveEntry, getLastNEntries, saveWeeklyAim, subscribeToActiveWeeklyAim, closeActiveWeeklyAims, completeWeeklyAim, updateWeeklyAimPlan } from "@/lib/firestore";
import type { EntryAnswers, WeeklyAim } from "@/lib/firestore";
import { CHECKIN_STEPS } from "@/lib/checkin-questions";
import { GlassCard } from "@/components/ui/GlassCard";
import { CheckinQuestion } from "@/components/checkin/CheckinQuestion";
import { StepNav } from "@/components/checkin/StepNav";
import { WeeklyAimStep } from "@/components/checkin/WeeklyAimStep";
import { generateDirectionPlan, generateReflectionSummary, computeBehavioralContext, buildFallbackPlan } from "@/lib/direction-ai";
import Link from "next/link";

const EMPTY_ANSWERS: Partial<EntryAnswers> = {
  mood: "",
  energy: "",
  focus: "",
  stress: "",
  sleepHours: 0,
  screenTimeHours: 0,
  win: "",
  struggle: "",
};

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDayNumber(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date(getTodayDateStr());
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(diff + 1, 1), 7);
}

interface CheckinClientProps {
  step: string;
}

const BASE_TOTAL_STEPS = CHECKIN_STEPS.length; // 8
const TOTAL_STEPS = BASE_TOTAL_STEPS + 1;       // 9 with aim step

// Completion question state
type CompletionState = "asking" | "submitting" | "done";

export function CheckinClient({ step }: CheckinClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const stepNum = Math.min(
    TOTAL_STEPS,
    Math.max(1, parseInt(String(step ?? "1"), 10))
  );

  const [answers, setAnswers] = useState<Partial<EntryAnswers>>(EMPTY_ANSWERS);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Active aim (for reminder banner and Day 7 completion)
  const [activeAim, setActiveAim] = useState<WeeklyAim | null | undefined>(undefined);
  const [completionState, setCompletionState] = useState<CompletionState>("asking");
  const [completionAnswer, setCompletionAnswer] = useState<"yes" | "partially" | "no" | null>(null);
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);

  const currentStep = CHECKIN_STEPS[stepNum - 1]; // undefined if step === 9
  const currentValue = currentStep ? answers[currentStep.key] : undefined;

  // Load active aim on mount (real-time)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToActiveWeeklyAim(user.uid, (aim) => {
      setActiveAim(aim);
      // If Day 7 has been reached and status is still active, trigger completion flow
      if (aim && getDayNumber(aim.startDate) >= 7 && stepNum === 1) {
        setShowCompletionFlow(true);
      }
    });

    return () => unsubscribe();
  }, [user, stepNum]);

  const persistDraft = useCallback(
    async (partial: Partial<EntryAnswers>) => {
      if (!user) return;
      setSaving(true);
      try {
        await saveEntry(user.uid, getTodayDateStr(), partial, false);
      } catch (err) {
        console.error("Draft save failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  const updateAnswer = useCallback(
    (key: keyof EntryAnswers, value: string | number) => {
      setAnswers((prev) => {
        const next = { ...prev, [key]: value };
        persistDraft({ [key]: value });
        return next;
      });
    },
    [persistDraft]
  );

  const handleNext = useCallback(async () => {
    if (!user) return;

    const isLast = stepNum === BASE_TOTAL_STEPS;
    const merged: EntryAnswers = {
      mood: String(answers.mood ?? ""),
      energy: String(answers.energy ?? ""),
      focus: String(answers.focus ?? ""),
      stress: String(answers.stress ?? ""),
      sleepHours: Number(answers.sleepHours ?? 0),
      screenTimeHours: Number(answers.screenTimeHours ?? 0),
      win: String(answers.win ?? ""),
      struggle: String(answers.struggle ?? ""),
    };

    if (isLast) {
      // Save the entry as complete, then proceed to Step 9 (aim step)
      setSaving(true);
      try {
        await saveEntry(user.uid, getTodayDateStr(), merged, true);
        // Navigate to step 9
        router.push(`/checkin/9`);
      } catch (err) {
        toast.error("Failed to save. Try again.");
        setSaving(false);
      }
    } else {
      router.push(`/checkin/${stepNum + 1}`);
    }
  }, [user, stepNum, answers, router]);

  // Handle Step 9: save aim and generate plan
  const handleAimSubmit = useCallback(
    async (aimText: string) => {
      if (!user) return;
      setGeneratingPlan(true);
      try {
        const today = getTodayDateStr();
        const endDate = addDays(today, 6);

        // Fetch last 7 days for behavioral context
        const recentEntries = await getLastNEntries(user.uid, 7);
        const ctx = computeBehavioralContext(recentEntries);

        // Step 1: Save aim immediately with a fallback plan — user is never blocked
        const fallback = buildFallbackPlan(aimText);
        const aimId = await saveWeeklyAim(user.uid, {
          aimText,
          startDate: today,
          endDate,
          status: "active",
          planRaw: fallback.planRaw,
          planTitle: fallback.planTitle,
          days: fallback.days,
          checkpoints: fallback.checkpoints,
          ifYouMissDay: fallback.ifYouMissDay,
        });

        // Step 2: Redirect immediately for better UX
        router.push("/app");
        toast.success("Aim set! BECOMING is building your strategic plan...");

        // Step 3: Trigger AI generation in the background
        // We don't await this so the user isn't blocked.
        generateDirectionPlan(aimText, ctx)
          .then(async (normalized) => {
            await updateWeeklyAimPlan(user.uid, aimId, normalized.planRaw, normalized.planTitle, normalized.days, {
              goalInterpretation: normalized.goalInterpretation,
              strategicBreakdown: normalized.strategicBreakdown,
              expectedOutcome: normalized.expectedOutcome,
              riskAdvice: normalized.riskAdvice,
              behavioralInsights: normalized.behavioralInsights,
            });
            // Optional: toast.success("AI Plan ready!"); 
            // Better to just let the dashboard update live via listener.
          })
          .catch((aiErr) => {
            console.error("[Gemini] Background generation failed:", aiErr);
            // Fallback plan is already in place, so we just log the failure.
          });
      } catch (err) {
        console.error("Aim save failed:", err);
        toast.error("Failed to save aim. Try again.");
        setGeneratingPlan(false);
      }
    },
    [user, router]
  );

  // Handle Day 7 completion submission
  const handleCompletionSubmit = useCallback(
    async (result: "yes" | "partially" | "no") => {
      if (!user || !activeAim) return;
      setCompletionState("submitting");
      setCompletionAnswer(result);
      try {
        const recentEntries = await getLastNEntries(user.uid, 7);
        const ctx = computeBehavioralContext(recentEntries);
        const reflection = await generateReflectionSummary(activeAim.aimText, result, ctx);
        await completeWeeklyAim(user.uid, activeAim.id, result, reflection);
        setCompletionState("done");
      } catch (err) {
        console.error("Completion failed:", err);
        toast.error("Something went wrong. Try again.");
        setCompletionState("asking");
      }
    },
    [user, activeAim]
  );

  useEffect(() => {
    if (stepNum < 1 || stepNum > TOTAL_STEPS) {
      router.replace("/checkin/1");
    }
  }, [stepNum, router]);

  useEffect(() => {
    if (!user) return;
    getEntry(user.uid, getTodayDateStr()).then((entry) => {
      if (entry?.answers) {
        setAnswers((prev) => ({ ...prev, ...entry.answers }));
      }
    });
  }, [user]);

  // Day 7 Completion Flow — render before the normal check-in
  if (showCompletionFlow && activeAim && stepNum === 1) {
    if (completionState === "done") {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <GlassCard className="w-full max-w-xl p-6 sm:p-8 space-y-6">
            <p className="text-xs text-white/40 uppercase tracking-widest">7-Day Direction — Complete</p>
            <h2 className="text-xl font-bold">Your aim is closed.</h2>
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">
              {activeAim.reflectionSummary ?? "Reflection saved."}
            </p>
            <button
              onClick={() => setShowCompletionFlow(false)}
              className="text-neon-cyan text-sm hover:underline"
            >
              Continue to check-in →
            </button>
          </GlassCard>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <GlassCard className="w-full max-w-xl p-6 sm:p-8 space-y-6">
          <p className="text-xs text-white/40 uppercase tracking-widest">7-Day Direction — Day 7</p>
          <h2 className="text-lg font-bold">
            Did you complete your aim?
          </h2>
          <p className="text-white/60 text-sm italic border-l-2 border-neon-cyan/40 pl-3">
            &ldquo;{activeAim.aimText}&rdquo;
          </p>
          <div className="flex flex-col gap-3">
            {(["yes", "partially", "no"] as const).map((opt) => (
              <button
                key={opt}
                disabled={completionState === "submitting"}
                onClick={() => handleCompletionSubmit(opt)}
                className={`w-full py-3 rounded-xl font-semibold text-sm border transition-all
                  ${completionState === "submitting" && completionAnswer === opt
                    ? "bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan"
                    : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed capitalize`}
              >
                {completionState === "submitting" && completionAnswer === opt
                  ? "Reflecting..."
                  : opt === "yes" ? "Yes, I completed it" : opt === "partially" ? "Partially" : "No"}
              </button>
            ))}
          </div>
          {completionState === "submitting" && (
            <p className="text-white/40 text-xs text-center animate-pulse">
              BECOMING is generating your reflection...
            </p>
          )}
        </GlassCard>
      </div>
    );
  }

  // Step 9: Weekly Aim Step
  if (stepNum === 9) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <GlassCard className="w-full max-w-xl p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/app" className="text-sm text-white/60 hover:text-neon-cyan">
              Skip
            </Link>
            <span className="text-sm text-white/50">Step 9 of 9</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key="aim-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <WeeklyAimStep
                displayName={user?.displayName ?? "there"}
                onSubmit={handleAimSubmit}
                isSubmitting={generatingPlan}
              />
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    );
  }

  if (!currentStep) return null;

  const canProceed =
    currentStep.type === "textarea" ||
    currentStep.type === "number" ||
    (currentStep.type === "radio" && currentValue);

  // Compute day number for the reminder banner
  const dayNum = activeAim ? getDayNumber(activeAim.startDate) : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl space-y-3">
        {/* Retention reminder banner */}
        {activeAim && dayNum !== null && dayNum <= 6 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 text-sm text-white/70"
          >
            <span className="text-neon-cyan font-semibold text-xs shrink-0">
              Day {dayNum}/7
            </span>
            <span className="truncate">
              Direction: <span className="text-white/90 italic">{activeAim.aimText}</span>
            </span>
          </motion.div>
        )}

        <GlassCard className="w-full p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/app" className="text-sm text-white/60 hover:text-neon-cyan">
              Dashboard
            </Link>
            <span className="text-sm text-white/50">
              Step {stepNum} of {TOTAL_STEPS}
              {saving && " · Saving..."}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={stepNum}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CheckinQuestion
                step={currentStep}
                value={currentValue}
                onChange={(v) => updateAnswer(currentStep.key, v)}
              />
              <StepNav
                step={stepNum}
                totalSteps={TOTAL_STEPS}
                onNext={handleNext}
                nextDisabled={!canProceed || saving}
              />
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
}
