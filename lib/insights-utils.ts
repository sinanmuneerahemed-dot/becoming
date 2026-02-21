/**
 * Mapping and analytics utilities for insight computation.
 * Works with normalized Entry schema: mood, energy, focus, stress, sleepHours, screenTimeHours, win, struggle.
 */

const THEME_KEYWORDS: Record<string, string[]> = {
  distraction: ["distract", "phone", "social media", "notification", "scroll", "browse"],
  procrastination: ["procrastinat", "delay", "put off", "avoid", "later"],
  sleep: ["sleep", "tired", "exhausted", "rest", "insomnia", "wake"],
  stress: ["stress", "anxious", "overwhelm", "pressure", "worr"],
  confidence: ["confident", "proud", "accomplish", "achieved", "did it", "win"],
  "time-management": ["time", "schedule", "plan", "deadline", "rushed"],
};

/**
 * Get focus category (handles both string labels and legacy numeric).
 */
export function mapFocusToCategory(focus: string | number | undefined): string {
  if (typeof focus === "string" && focus) return focus;
  if (focus === undefined || focus === null) return "Normal";
  const n = Number(focus);
  if (n <= 2) return "Distracted";
  if (n <= 5) return "Normal";
  if (n <= 8) return "Focused";
  return "Deep Focus";
}

/**
 * Check if stress is high (Stressed or Overwhelmed).
 */
export function isHighStress(stress: string | undefined): boolean {
  if (!stress) return false;
  const s = stress.toLowerCase();
  return s === "stressed" || s === "overwhelmed";
}

/**
 * Focus score 1-4 for trend (Distracted=1, Normal=2, Focused=3, Deep Focus=4).
 */
export function getFocusScore(focus: string | number | undefined): number {
  const cat = mapFocusToCategory(focus);
  if (cat === "Distracted") return 1;
  if (cat === "Normal") return 2;
  if (cat === "Focused") return 3;
  return 4;
}

/**
 * Mood score 1-5 for trend (Very Low=1 ... Excellent=5).
 */
export function getMoodScore(mood: string | undefined): number {
  if (!mood) return 3;
  const scores: Record<string, number> = {
    "Very Low": 1,
    Low: 2,
    Good: 3,
    "Very Good": 4,
    Excellent: 5,
  };
  return scores[mood] ?? 3;
}

/**
 * Legacy: emotion string to mood-like score (for old data).
 */
export function getEmotionScore(emotion: string): number {
  if (!emotion) return 3;
  const e = emotion.toLowerCase();
  if (["overwhelmed", "anxious", "tired"].some((x) => e.includes(x))) return 1;
  if (e.includes("content") || e.includes("calm")) return 3;
  if (["energized", "motivated", "focused"].some((x) => e.includes(x))) return 4;
  return 3;
}

/**
 * Legacy: emotion to stress level.
 */
export function getEmotionStressLevel(emotion: string): string {
  if (!emotion || typeof emotion !== "string") return "calm";
  const e = emotion.toLowerCase();
  if (e.includes("overwhelm") || e.includes("anxious")) return "overwhelmed";
  if (e.includes("stress") || e.includes("pressure")) return "stressed";
  if (e.includes("tired") || e.includes("worry")) return "slight";
  return "calm";
}

/**
 * Light keyword grouping for win/struggle text.
 */
export function extractKeywords(text: string, themes: string[] = Object.keys(THEME_KEYWORDS)): string[] {
  if (!text || typeof text !== "string") return [];
  const t = text.toLowerCase();
  const found: string[] = [];
  for (const theme of themes) {
    const keywords = THEME_KEYWORDS[theme];
    if (keywords?.some((kw) => t.includes(kw))) found.push(theme);
  }
  return found;
}
