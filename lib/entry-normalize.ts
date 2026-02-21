/**
 * Normalize raw Firestore entry answers to canonical schema.
 * Supports both old format (emotion, focus number, distraction, screenTimeMinutes)
 * and new format (mood, energy, focus string, stress, struggle, screenTimeHours).
 */

export interface NormalizedAnswers {
  mood: string;
  energy: string;
  focus: string;
  stress: string;
  sleepHours: number;
  screenTimeHours: number;
  win: string;
  struggle: string;
}

const MOOD_LABELS = ["Very Low", "Low", "Good", "Very Good", "Excellent"];
const ENERGY_LABELS = ["Drained", "Low", "Balanced", "High", "Powerful"];
const FOCUS_LABELS = ["Distracted", "Normal", "Focused", "Deep Focus"];
const STRESS_LABELS = ["Calm", "Slight", "Stressed", "Overwhelmed"];

function mapNumToLabel(n: number, labels: string[]): string {
  const idx = Math.max(0, Math.min(Math.round(n) - 1, labels.length - 1));
  return labels[idx] ?? labels[0] ?? "";
}

export function normalizeEntryAnswers(raw: Record<string, unknown> | null | undefined): NormalizedAnswers {
  const r = raw ?? {};

  // New format fields
  const mood = typeof r.mood === "string" ? r.mood : "";
  const energy = typeof r.energy === "string" ? r.energy : "";
  const focusStr = typeof r.focus === "string" ? r.focus : "";
  const stress = typeof r.stress === "string" ? r.stress : "";
  const struggle = typeof r.struggle === "string" ? r.struggle : "";

  // Legacy: mood from emotion or number 1-5
  const resolvedMood =
    mood ||
    (typeof r.emotion === "string" ? r.emotion : "") ||
    (typeof r.mood === "number" ? mapNumToLabel(r.mood as number, MOOD_LABELS) : "");

  // Legacy: focus from number 1-10 -> 1-4 scale for labels
  const focusNum = typeof r.focus === "number" ? r.focus : undefined;
  const resolvedFocus =
    focusStr ||
    (focusNum !== undefined
      ? focusNum <= 2
        ? "Distracted"
        : focusNum <= 5
          ? "Normal"
          : focusNum <= 8
            ? "Focused"
            : "Deep Focus"
      : "");

  // Legacy: stress from emotion or number 1-4
  const resolvedStress =
    stress ||
    (typeof r.stress === "number" ? mapNumToLabel(r.stress as number, STRESS_LABELS) : "") ||
    (typeof r.emotion === "string" && /overwhelm|anxious/i.test(r.emotion) ? "Overwhelmed" : "") ||
    (typeof r.emotion === "string" && /stress|pressure/i.test(r.emotion) ? "Stressed" : "");

  // Legacy: energy from number 1-5
  const resolvedEnergy =
    energy || (typeof r.energy === "number" ? mapNumToLabel(r.energy as number, ENERGY_LABELS) : "");

  // screenTimeHours: new format or convert from screenTimeMinutes
  const screenMinutes = typeof r.screenTimeMinutes === "number" ? r.screenTimeMinutes : 0;
  const screenHoursNew = typeof r.screenTimeHours === "number" ? r.screenTimeHours : undefined;
  const resolvedScreenHours = screenHoursNew ?? (screenMinutes > 0 ? screenMinutes / 60 : 0);

  // struggle: new format or legacy distraction
  const resolvedStruggle = struggle || (typeof r.distraction === "string" ? r.distraction : "");

  return {
    mood: resolvedMood,
    energy: resolvedEnergy,
    focus: resolvedFocus,
    stress: resolvedStress,
    sleepHours: typeof r.sleepHours === "number" ? r.sleepHours : 0,
    screenTimeHours: resolvedScreenHours,
    win: typeof r.win === "string" ? r.win : "",
    struggle: resolvedStruggle,
  };
}
