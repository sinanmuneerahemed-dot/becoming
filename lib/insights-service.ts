import type { Timestamp } from "firebase/firestore";
import type { Entry } from "./firestore";
import { getLastNEntries, getInsightDoc, saveInsightDoc } from "./firestore";
import {
  mapFocusToCategory,
  isHighStress,
  extractKeywords,
  getMoodScore,
} from "./insights-utils";

export interface WeeklyInsight {
  windowStart: string;
  windowEnd: string;
  suggestions: string[];
  note: string;
  entryCount: number;
}

export interface MonthlyInsight {
  windowStart: string;
  windowEnd: string;
  suggestions: string[];
  note: string;
  entryCount: number;
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const maybeCode = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (maybeCode === "permission-denied") return true;

  const maybeMessage = "message" in err ? (err as { message?: unknown }).message : undefined;
  return typeof maybeMessage === "string" && maybeMessage.includes("Missing or insufficient permissions");
}

async function safeGetCachedInsight(
  uid: string,
  type: "weekly" | "monthly"
) {
  try {
    return await getInsightDoc(uid, type);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return null;
    }
    throw err;
  }
}

async function safeSaveInsight(
  uid: string,
  type: "weekly" | "monthly",
  insight: WeeklyInsight | MonthlyInsight
): Promise<void> {
  try {
    await saveInsightDoc(uid, type, insight);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return;
    }
    throw err;
  }
}

function mostFrequent<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  let max = 0;
  let result: T | null = null;
  for (const v of arr) {
    const k = String(v ?? "");
    counts[k] = (counts[k] ?? 0) + 1;
    if (counts[k] > max) {
      max = counts[k];
      result = v;
    }
  }
  return result;
}

function computeWeeklySuggestions(
  entries: Entry[],
  avgSleep: number,
  avgScreenHours: number,
  lowSleepCount: number,
  highScreenCount: number,
  stressCount: number,
  distractedCount: number,
  moodTrend: "up" | "down" | "stable"
): string[] {
  const suggestions: string[] = [];

  if (lowSleepCount >= 3) {
    suggestions.push(`Your sleep is low (avg ${avgSleep.toFixed(1)}h). Aim for 7+ hours for 3 nights.`);
  }
  if (avgScreenHours > 5) {
    suggestions.push("Consider reducing screen time. Aim for under 5 hours per day to improve focus and rest.");
  }
  if (highScreenCount >= 3 && distractedCount >= 3) {
    suggestions.push("High screen time is linked with low focus. Reduce 30–60 minutes for 3 days.");
  }
  if (stressCount >= 3) {
    suggestions.push("Stress is frequent. Try a 5-minute reset: breathing or quick journaling.");
  }
  if (moodTrend === "down") {
    suggestions.push("Mood dipped this week. Review your Struggle notes to spot triggers.");
  }
  if (moodTrend === "up") {
    suggestions.push("Your mood improved this week—repeat what worked on your best days.");
  }
  if (distractedCount >= 3) {
    suggestions.push("Focus has been challenging. Use one protected 30-minute deep-work block daily.");
  }
  suggestions.push("Study plan: do 2x25-minute focused blocks today with a short break between blocks.");

  if (suggestions.length < 4 && entries.length >= 7) {
    suggestions.push("You're maintaining solid habits. Consider adding one intentional break or reflection moment daily.");
  }

  return suggestions.slice(0, 5);
}

function computeMonthlySuggestions(
  entries: Entry[],
  avgSleep: number,
  avgScreenHours: number,
  stressCount: number,
  distractedCount: number,
  moodTrend: "up" | "down" | "stable",
  struggleTheme: string | null,
  winTheme: string | null
): string[] {
  const suggestions: string[] = [];

  if (avgSleep < 6) {
    suggestions.push("Sleep average is under 6 hours. A consistent bedtime can improve energy and focus.");
  }
  if (avgScreenHours > 5) {
    suggestions.push("Screen time is high. Set app limits or use focus modes during work blocks.");
  }
  if (avgScreenHours > 5 && distractedCount >= 5) {
    suggestions.push("High screen time plus frequent distraction. Try 2x25-minute Pomodoro blocks with a short reset between them.");
  }
  if (stressCount >= 5) {
    suggestions.push("Stress shows up often. Build in regular recovery—even 5 minutes of breathing or stretching helps.");
  }
  if (moodTrend === "down") {
    suggestions.push("Mood has trended down over the month. Focus on one small habit that usually lifts you.");
  }
  if (moodTrend === "up") {
    suggestions.push("Strong upward mood trend. Reinforce what's working and share it with someone.");
  }
  if (distractedCount >= 8) {
    suggestions.push("Distraction is a recurring theme. Identify your top 2 triggers and add simple barriers.");
  }
  if (struggleTheme === "procrastination") {
    suggestions.push("Procrastination appears often. Break tasks into smaller steps and start with 5 minutes.");
  }
  if (struggleTheme === "sleep") {
    suggestions.push("Sleep is a common challenge. Try winding down 30 min earlier without screens.");
  }
  if (winTheme === "confidence") {
    suggestions.push("You're noting wins. Keep tracking—it reinforces positive patterns.");
  }
  if (suggestions.length < 5) {
    suggestions.push("Overall trends are mixed. Pick one metric to improve next month (sleep, screen time, or focus blocks).");
  }

  return suggestions.slice(0, 8);
}

function buildWeeklyNote(
  positive: string,
  challenge: string,
  nextStep: string
): string {
  const lines = [positive, challenge, nextStep].filter(Boolean);
  return lines.join("\n");
}

function buildMonthlyNote(
  trend1: string,
  trend2: string,
  streakLine: string,
  struggleTheme: string | null,
  winTheme: string | null,
  nextStep1: string,
  nextStep2: string
): string {
  const parts: string[] = [trend1, trend2];
  if (streakLine) parts.push(streakLine);
  if (struggleTheme) parts.push(`Common struggle theme: ${struggleTheme}`);
  if (winTheme) parts.push(`Common win theme: ${winTheme}`);
  parts.push(nextStep1, nextStep2);
  return parts.filter(Boolean).join("\n");
}

export function computeWeeklyInsights(entries: Entry[]): WeeklyInsight | null {
  if (entries.length < 7) return null;

  const windowEntries = entries.slice(-7);
  const windowStart = windowEntries[0]!.date;
  const windowEnd = windowEntries[windowEntries.length - 1]!.date;

  const sleepValues = windowEntries.map((e) => e.answers.sleepHours ?? 0).filter((v) => v > 0);
  const avgSleep = sleepValues.length > 0
    ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
    : 0;

  const screenValues = windowEntries.map((e) => e.answers.screenTimeHours ?? 0).filter((v) => v >= 0);
  const avgScreenHours = screenValues.length > 0
    ? screenValues.reduce((a, b) => a + b, 0) / screenValues.length
    : 0;

  const moods = windowEntries.map((e) => e.answers.mood).filter(Boolean) as string[];
  const mostCommonMood = mostFrequent(moods);

  const focusCats = windowEntries.map((e) => mapFocusToCategory(e.answers.focus));
  const mostCommonFocus = mostFrequent(focusCats);

  const stressCount = windowEntries.filter((e) => isHighStress(e.answers.stress)).length;

  const distractedCount = windowEntries.filter(
    (e) => mapFocusToCategory(e.answers.focus) === "Distracted"
  ).length;

  const lowSleepCount = windowEntries.filter((e) => (e.answers.sleepHours ?? 0) < 6).length;
  const highScreenCount = windowEntries.filter((e) => (e.answers.screenTimeHours ?? 0) > 5).length;

  const first3 = windowEntries.slice(0, 3);
  const last3 = windowEntries.slice(-3);
  const avgFirst = first3.reduce((s, e) => s + getMoodScore(e.answers.mood), 0) / 3;
  const avgLast = last3.reduce((s, e) => s + getMoodScore(e.answers.mood), 0) / 3;
  const moodTrend: "up" | "down" | "stable" =
    avgLast - avgFirst > 0.3 ? "up" : avgFirst - avgLast > 0.3 ? "down" : "stable";

  const suggestions = computeWeeklySuggestions(
    windowEntries,
    avgSleep,
    avgScreenHours,
    lowSleepCount,
    highScreenCount,
    stressCount,
    distractedCount,
    moodTrend
  );

  const positive =
    mostCommonMood
      ? `Your most common mood this week was "${mostCommonMood}".`
      : "You completed 7 check-ins—consistency matters.";
  const challenge =
    lowSleepCount >= 2
      ? `Sleep averaged ${avgSleep.toFixed(1)}h and was below 6h on several days.`
      : highScreenCount >= 2
        ? "Screen time exceeded 5 hours on multiple days."
        : stressCount >= 2
          ? `Stress was high on ${stressCount} days.`
          : "A few days had lower focus.";
  const nextStep =
    avgSleep < 6
      ? "Next week: protect sleep (7+ hours, 3 nights) and use 2x25-minute study blocks on weekdays."
      : distractedCount >= 2
        ? "Next week: run 2x25-minute focused-work blocks each day."
        : "Next week: keep tracking and look for one small improvement.";

  const note = buildWeeklyNote(positive, challenge, nextStep);

  return {
    windowStart,
    windowEnd,
    suggestions,
    note,
    entryCount: windowEntries.length,
  };
}

export function computeMonthlyInsights(entries: Entry[]): MonthlyInsight | null {
  if (entries.length < 30) return null;

  const windowEntries = entries.slice(-30);
  const windowStart = windowEntries[0]!.date;
  const windowEnd = windowEntries[windowEntries.length - 1]!.date;

  const sleepValues = windowEntries.map((e) => e.answers.sleepHours ?? 0).filter((v) => v > 0);
  const avgSleep = sleepValues.length > 0
    ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
    : 0;

  const screenValues = windowEntries.map((e) => e.answers.screenTimeHours ?? 0).filter((v) => v >= 0);
  const avgScreenHours = screenValues.length > 0
    ? screenValues.reduce((a, b) => a + b, 0) / screenValues.length
    : 0;

  const stressCount = windowEntries.filter((e) => isHighStress(e.answers.stress)).length;

  const distractedCount = windowEntries.filter(
    (e) => mapFocusToCategory(e.answers.focus) === "Distracted"
  ).length;

  const first10 = windowEntries.slice(0, 10);
  const last10 = windowEntries.slice(-10);
  const avgFirst = first10.reduce((s, e) => s + getMoodScore(e.answers.mood), 0) / 10;
  const avgLast = last10.reduce((s, e) => s + getMoodScore(e.answers.mood), 0) / 10;
  const moodTrend: "up" | "down" | "stable" =
    avgLast - avgFirst > 0.2 ? "up" : avgFirst - avgLast > 0.2 ? "down" : "stable";

  const struggleKeywords: string[] = [];
  windowEntries.forEach((e) => {
    struggleKeywords.push(...extractKeywords(e.answers.struggle ?? ""));
  });
  const struggleCounts: Record<string, number> = {};
  struggleKeywords.forEach((k) => { struggleCounts[k] = (struggleCounts[k] ?? 0) + 1; });
  const struggleTheme =
    Object.keys(struggleCounts).length > 0
      ? Object.entries(struggleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      : null;

  const winKeywords: string[] = [];
  windowEntries.forEach((e) => {
    winKeywords.push(...extractKeywords(e.answers.win ?? ""));
  });
  const winCounts: Record<string, number> = {};
  winKeywords.forEach((k) => { winCounts[k] = (winCounts[k] ?? 0) + 1; });
  const winTheme =
    Object.keys(winCounts).length > 0
      ? Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      : null;

  const dates = windowEntries.map((e) => e.date).sort();
  let longestStreak = 0;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]!);
    const curr = new Date(dates[i]!);
    prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === dates[i]) {
      current++;
    } else {
      longestStreak = Math.max(longestStreak, current);
      current = 1;
    }
  }
  longestStreak = Math.max(longestStreak, current);

  const suggestions = computeMonthlySuggestions(
    windowEntries,
    avgSleep,
    avgScreenHours,
    stressCount,
    distractedCount,
    moodTrend,
    struggleTheme,
    winTheme
  );

  const trend1 =
    moodTrend === "up"
      ? "Mood has improved over the month."
      : moodTrend === "down"
        ? "Mood has trended down—worth checking in on habits."
        : "Mood has been relatively stable.";
  const streakLine = longestStreak > 0 ? `Longest streak in last 30: ${longestStreak} days.` : "";
  const trend2 =
    avgSleep >= 7
      ? "Sleep habits look solid."
      : avgSleep < 6
        ? "Sleep is a key area to improve."
        : "Sleep is in a moderate range.";
  const nextStep1 =
    avgSleep < 6
      ? "Focus on a consistent sleep schedule."
      : distractedCount >= 5
        ? "Add 2x25-minute focus blocks with short breaks."
        : "Keep tracking and identify one improvement area.";
  const nextStep2 = struggleTheme
    ? `Address the "${struggleTheme}" theme with one small change.`
    : "Reflect on what's working and double down.";

  const note = buildMonthlyNote(
    trend1,
    trend2,
    streakLine,
    struggleTheme,
    winTheme,
    nextStep1,
    nextStep2
  );

  return {
    windowStart,
    windowEnd,
    suggestions,
    note,
    entryCount: windowEntries.length,
  };
}

function toMillis(ts: Timestamp | null | undefined): number {
  if (!ts || typeof ts.toMillis !== "function") return 0;
  return ts.toMillis();
}

export async function getOrComputeWeeklyInsights(uid: string): Promise<WeeklyInsight | null> {
  const [cached, entries] = await Promise.all([
    safeGetCachedInsight(uid, "weekly"),
    getLastNEntries(uid, 7),
  ]);

  if (entries.length < 7) {
    console.log("WeeklyInsights: Not enough entries", entries.length);
    return null;
  }

  const windowEntries = entries.slice(-7);
  console.log("WeeklyInsights: Window", windowEntries.map((e) => e.date));
  const needsRecompute =
    !cached ||
    cached.entryCount !== windowEntries.length ||
    windowEntries.some((e) => toMillis(e.updatedAt) > toMillis(cached.computedAt));

  if (!needsRecompute) {
    return {
      windowStart: cached!.windowStart,
      windowEnd: cached!.windowEnd,
      suggestions: cached!.suggestions,
      note: cached!.note,
      entryCount: cached!.entryCount,
    };
  }

  console.log("WeeklyInsights: Recomputing...");
  const insight = computeWeeklyInsights(entries);
  if (!insight) {
    console.log("WeeklyInsights: Computation returned null");
    return null;
  }

  await safeSaveInsight(uid, "weekly", insight);
  return insight;
}

export async function getOrComputeMonthlyInsights(uid: string): Promise<MonthlyInsight | null> {
  const [cached, entries] = await Promise.all([
    safeGetCachedInsight(uid, "monthly"),
    getLastNEntries(uid, 30),
  ]);

  if (entries.length < 30) return null;

  const windowEntries = entries.slice(-30);
  const needsRecompute =
    !cached ||
    cached.entryCount !== windowEntries.length ||
    windowEntries.some((e) => toMillis(e.updatedAt) > toMillis(cached.computedAt));

  if (!needsRecompute) {
    return {
      windowStart: cached!.windowStart,
      windowEnd: cached!.windowEnd,
      suggestions: cached!.suggestions,
      note: cached!.note,
      entryCount: cached!.entryCount,
    };
  }

  const insight = computeMonthlyInsights(entries);
  if (!insight) return null;

  await safeSaveInsight(uid, "monthly", insight);
  return insight;
}
