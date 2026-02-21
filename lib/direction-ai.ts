/**
 * direction-ai.ts
 * Client-side planner logic for the 7-Day Direction System.
 * AI calls are proxied through /api/ai/generate (server-side key).
 */

import type { DayPlan } from "./firestore";

export interface BehavioralContext {
    avgMood: number;       // 1-5 scale
    avgEnergy: number;     // 1-5 scale
    avgFocus: number;      // 1-4 scale
    avgStress: number;     // 1-4 scale
    avgSleep: number;      // hours
    avgScreenTime: number; // hours
    commonStruggle: string;
}

export interface DirectionPlan {
    planTitle: string;
    planRaw: string;
    days: DayPlan[];
}

interface GeminiGenerationOptions {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
}

interface StructuredPlanDay {
    day?: unknown;
    focus?: unknown;
    schedule?: unknown;
    tasks?: unknown;
    totalActiveTime?: unknown;
    totalRest?: unknown;
}

interface StructuredPlanPayload {
    planTitle?: unknown;
    days?: unknown;
    checkpoints?: unknown;
    ifYouMissDay?: unknown;
}

interface NormalizedPlan {
    planTitle: string;
    days: DayPlan[];
    checkpoints: {
        day3: string;
        day7: string;
    };
    ifYouMissDay: string;
}

type GoalType =
    | "academic"
    | "fitness"
    | "habit"
    | "creative"
    | "health"
    | "productivity";

interface DailyTarget {
    count: number;
    unitSingular: string;
    unitPlural: string;
}

interface BlockDurations {
    focusMinutes: number;
    breakMinutes: number;
    reviewMinutes: number;
    reviewBreakMinutes: number;
}

type EmotionalTone =
    | "overwhelmed"
    | "anxious"
    | "frustrated"
    | "low_mood"
    | "confused"
    | "neutral";

type IntentType =
    | "stabilize"
    | "improve_performance"
    | "build_consistency"
    | "recover_balance"
    | "clarify_direction";

type ProblemTheme =
    | "phone-distraction"
    | "focus"
    | "sleep"
    | "stress"
    | "procrastination"
    | "energy"
    | "emotional-regulation"
    | "planning"
    | "confidence"
    | "productivity";

interface AimInsight {
    tone: EmotionalTone;
    intent: IntentType;
    themes: ProblemTheme[];
}

const PLAN_RETRY_OPTIONS: GeminiGenerationOptions[] = [
    { temperature: 0.25, maxOutputTokens: 1700, responseMimeType: "application/json" },
    { temperature: 0.15, maxOutputTokens: 1400, responseMimeType: "application/json" },
    { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: "application/json" },
];

const MIN_TASKS_PER_DAY = 3;
const MIN_SCHEDULE_LINES = 3;
const DAILY_TARGET_REGEX = /(\d{1,3})\s*(chapter|chapters|page|pages|problem|problems|task|tasks|lesson|lessons|module|modules|video|videos|exercise|exercises|topic|topics|question|questions|set|sets|unit|units)\s*(?:(?:a|per)\s*day|\/\s*day|daily|every\s+day)\b/i;
const CLOCK_TIME_PREFIX_REGEX = /^\s*(?:\d{1,2}:\d{2}\s*[\-\u2013\u2014]\s*\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\s*[\-\u2013\u2014]\s*\d{1,2}\s*(?:am|pm))\s*[\-\u2013\u2014]?\s*/i;
const GENERIC_TASK_PATTERNS: RegExp[] = [
    /\bstay positive\b/i,
    /\btry to\b/i,
    /\bdo your best\b/i,
    /\bkeep going\b/i,
    /\bbe consistent\b/i,
    /\bstay motivated\b/i,
    /\bbelieve in yourself\b/i,
    /\bdon't give up\b/i,
];
const MEASURABLE_SIGNAL_REGEX =
    /\b(\d+(\.\d+)?)\b|\b(min|mins|minute|minutes|hour|hours|times|sessions|blocks|pages|chapter|chapters|tasks|steps|km|miles)\b/i;

function sanitizeText(value: unknown, fallback = ""): string {
    if (typeof value !== "string") return fallback;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed || fallback;
}

function sanitizeList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
}

function normalizeScheduleLine(line: string): string {
    const normalized = line
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return "";
    const withoutClockRange = normalized.replace(CLOCK_TIME_PREFIX_REGEX, "").trim();
    return withoutClockRange || normalized;
}

function hasDurationAndBreak(line: string): boolean {
    const lower = line.toLowerCase();
    const durationCount = line.match(/\d+\s*(?:m|min|mins|minute|minutes)\b/gi)?.length ?? 0;
    return /\bbreak\b/.test(lower) && durationCount >= 2;
}

function normalizeModelBlockLine(line: string, blockIndex: number, fallbackLine: string): string {
    const normalized = normalizeScheduleLine(line);
    if (!normalized) return fallbackLine;

    const withBlockPrefix = /^block\s*\d+/i.test(normalized)
        ? normalized
        : `Block ${blockIndex}: ${normalized}`;

    return hasDurationAndBreak(withBlockPrefix) ? withBlockPrefix : fallbackLine;
}

function splitEstimatedTime(estimatedTime: string): { active: string; rest: string } {
    const value = estimatedTime.trim();
    if (!value) return { active: "", rest: "" };

    if (/^rest:/i.test(value)) {
        return { active: "", rest: value.replace(/^rest:/i, "").trim() };
    }

    const split = value.split("| Rest:");
    if (split.length === 1) {
        return { active: split[0].trim(), rest: "" };
    }

    return {
        active: split[0].trim(),
        rest: split.slice(1).join("| Rest:").trim(),
    };
}

function formatMinutes(totalMinutes: number): string {
    const safe = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

function singularizeUnit(unit: string): string {
    const lower = unit.toLowerCase();
    const irregular: Record<string, string> = {
        exercises: "exercise",
        chapters: "chapter",
        pages: "page",
        problems: "problem",
        tasks: "task",
        lessons: "lesson",
        modules: "module",
        videos: "video",
        topics: "topic",
        questions: "question",
        sets: "set",
        units: "unit",
    };

    if (irregular[lower]) return irregular[lower];
    if (lower.endsWith("s")) return lower.slice(0, -1);
    return lower;
}

function pluralizeUnit(unitSingular: string): string {
    const irregular: Record<string, string> = {
        exercise: "exercises",
        chapter: "chapters",
        page: "pages",
        problem: "problems",
        task: "tasks",
        lesson: "lessons",
        module: "modules",
        video: "videos",
        topic: "topics",
        question: "questions",
        set: "sets",
        unit: "units",
    };

    return irregular[unitSingular] ?? (unitSingular.endsWith("s") ? unitSingular : `${unitSingular}s`);
}

function parseDailyTarget(aimText: string): DailyTarget | null {
    const match = aimText.match(DAILY_TARGET_REGEX);
    if (!match) return null;

    const count = Number(match[1]);
    if (!Number.isFinite(count) || count < 1) return null;

    const unitSingular = singularizeUnit(match[2]);
    return {
        count,
        unitSingular,
        unitPlural: pluralizeUnit(unitSingular),
    };
}

function formatDailyTarget(target: DailyTarget): string {
    const unit = target.count === 1 ? target.unitSingular : target.unitPlural;
    return `${target.count} ${unit} per day`;
}

function buildTargetPartitions(target: DailyTarget): Array<{ from: number; to: number }> {
    if (target.count <= 1) {
        return [{ from: 1, to: 1 }];
    }

    const firstPartitionCount = Math.ceil(target.count / 2);
    return [
        { from: 1, to: firstPartitionCount },
        { from: firstPartitionCount + 1, to: target.count },
    ];
}

function formatPartitionRange(target: DailyTarget, partition: { from: number; to: number }): string {
    if (partition.from === partition.to) {
        return `${target.unitSingular} ${partition.from}`;
    }
    return `${target.unitPlural} ${partition.from}-${partition.to}`;
}

function detectTone(aimText: string): EmotionalTone {
    const text = aimText.toLowerCase();
    if (/(overwhelm|burnout|can't cope|too much|breaking down|exhausted)/.test(text)) {
        return "overwhelmed";
    }
    if (/(anxious|anxiety|panic|worried|nervous|fear|afraid)/.test(text)) {
        return "anxious";
    }
    if (/(frustrated|irritated|angry|annoyed|stuck|fed up)/.test(text)) {
        return "frustrated";
    }
    if (/(sad|low|empty|numb|demotivated|hopeless|down)/.test(text)) {
        return "low_mood";
    }
    if (/(confused|unclear|lost|don't know|unsure|directionless)/.test(text)) {
        return "confused";
    }
    return "neutral";
}

function detectThemes(aimText: string): ProblemTheme[] {
    const text = aimText.toLowerCase();
    const themes: ProblemTheme[] = [];

    if (/(phone|instagram|youtube|tiktok|reel|social media|doomscroll|screen)/.test(text)) {
        themes.push("phone-distraction");
    }
    if (/(focus|distract|attention|deep work|concentrat)/.test(text)) {
        themes.push("focus");
    }
    if (/(sleep|insomnia|late night|wake up|bedtime|rest)/.test(text)) {
        themes.push("sleep");
    }
    if (/(stress|pressure|tense|overwhelm|overloaded)/.test(text)) {
        themes.push("stress");
    }
    if (/(procrastinat|delay|later|avoid|last minute)/.test(text)) {
        themes.push("procrastination");
    }
    if (/(energy|tired|fatigue|drained|exhaust)/.test(text)) {
        themes.push("energy");
    }
    if (/(emotion|mood|mental|mind|anxiety|sad|overthink)/.test(text)) {
        themes.push("emotional-regulation");
    }
    if (/(plan|schedule|routine|organize|structure)/.test(text)) {
        themes.push("planning");
    }
    if (/(confidence|self doubt|imposter|self-esteem)/.test(text)) {
        themes.push("confidence");
    }
    if (/(productiv|output|waste time|efficiency|performance)/.test(text)) {
        themes.push("productivity");
    }

    if (themes.length === 0) {
        themes.push("productivity");
    }

    return Array.from(new Set(themes)).slice(0, 3);
}

function detectIntent(aimText: string, goalType: GoalType, tone: EmotionalTone): IntentType {
    const text = aimText.toLowerCase();

    if (tone === "overwhelmed" || tone === "anxious") {
        return "stabilize";
    }
    if (/(consisten|habit|daily|routine|discipline)/.test(text)) {
        return "build_consistency";
    }
    if (/(recover|balance|reset|sleep|stress|calm)/.test(text)) {
        return "recover_balance";
    }
    if (/(clarity|direction|figure out|decide|priority)/.test(text)) {
        return "clarify_direction";
    }
    if (goalType === "academic" || goalType === "fitness" || goalType === "creative") {
        return "improve_performance";
    }
    return "improve_performance";
}

function analyzeAimInsight(aimText: string, goalType: GoalType): AimInsight {
    const tone = detectTone(aimText);
    const themes = detectThemes(aimText);
    const intent = detectIntent(aimText, goalType, tone);
    return { tone, intent, themes };
}

function getThemeStrategy(theme: ProblemTheme): { setup: string; execution: string; review: string } {
    switch (theme) {
        case "phone-distraction":
            return {
                setup: "phone parked outside arm's reach + distracting apps blocked",
                execution: "single-task sprint with zero social feed access",
                review: "screen audit: total social minutes and top trigger moments",
            };
        case "focus":
            return {
                setup: "define one clear target and remove all non-essential tabs",
                execution: "deep-focus sprint on one deliverable only",
                review: "log completion ratio and top distraction source",
            };
        case "sleep":
            return {
                setup: "set wind-down trigger and no-screen cutoff",
                execution: "night routine with low-stimulation activities",
                review: "record sleep start time and next-morning energy score",
            };
        case "stress":
            return {
                setup: "2-minute decompression + top-3 priorities list",
                execution: "priority-first work with deliberate breath reset",
                review: "stress check (1-10) and recovery choice for tomorrow",
            };
        case "procrastination":
            return {
                setup: "2-minute starter action on the hardest task",
                execution: "time-boxed progress sprint before any low-value task",
                review: "capture what caused delay and first fix for next day",
            };
        case "energy":
            return {
                setup: "hydration + quick movement activation",
                execution: "high-impact task during peak-energy window",
                review: "energy trend check and workload adjustment",
            };
        case "emotional-regulation":
            return {
                setup: "short grounding exercise + emotional label check",
                execution: "goal action while monitoring emotional drift",
                review: "journal one trigger and one healthy response",
            };
        case "planning":
            return {
                setup: "define top-3 outcomes and realistic effort budget",
                execution: "execute in planned order with one-task-at-a-time rule",
                review: "plan-vs-actual gap analysis for tomorrow",
            };
        case "confidence":
            return {
                setup: "state one evidence-based capability before starting",
                execution: "complete a meaningful challenge with proof artifact",
                review: "log one success signal and one growth edge",
            };
        default:
            return {
                setup: "clarify one measurable result and environment setup",
                execution: "focused progress sprint on top priority task",
                review: "capture metrics and next-day correction",
            };
    }
}

function getToneSupportInstruction(tone: EmotionalTone): string {
    switch (tone) {
        case "overwhelmed":
            return "Keep steps simple, low-friction, and recovery-aware; avoid overload.";
        case "anxious":
            return "Use calming structure: predictable sequence, small wins, and uncertainty reduction.";
        case "frustrated":
            return "Use short challenge-reward loops and clear progress proof to reduce frustration.";
        case "low_mood":
            return "Use very small but meaningful actions to rebuild momentum without pressure.";
        case "confused":
            return "Prioritize clarity: one decision checkpoint and one priority lock-in each day.";
        default:
            return "Supportive and direct coaching tone with clear accountability.";
    }
}

function formatThemeLabel(theme: ProblemTheme): string {
    return theme.replace(/-/g, " ");
}

function detectGoalType(aimText: string): GoalType {
    const text = aimText.toLowerCase();

    if (/(study|exam|chapter|revision|subject|assignment|homework|course|college|school)/.test(text)) {
        return "academic";
    }
    if (/(run|gym|workout|exercise|cardio|weights|strength|fitness|yoga|walk|training)/.test(text)) {
        return "fitness";
    }
    if (/(habit|routine|wake|sleep|quit|daily|every day|consisten|discipline|meditat)/.test(text)) {
        return "habit";
    }
    if (/(design|write|content|video|draw|music|creative|portfolio|draft|edit)/.test(text)) {
        return "creative";
    }
    if (/(health|meal|diet|nutrition|water|hydration|wellness|steps|recovery)/.test(text)) {
        return "health";
    }
    return "productivity";
}

function getFallbackDurations(goalType: GoalType): BlockDurations {
    if (goalType === "fitness") {
        return {
            focusMinutes: 30,
            breakMinutes: 8,
            reviewMinutes: 20,
            reviewBreakMinutes: 5,
        };
    }

    if (goalType === "habit" || goalType === "health") {
        return {
            focusMinutes: 25,
            breakMinutes: 5,
            reviewMinutes: 20,
            reviewBreakMinutes: 5,
        };
    }

    return {
        focusMinutes: 35,
        breakMinutes: 10,
        reviewMinutes: 25,
        reviewBreakMinutes: 5,
    };
}

function getGoalBlocks(goalType: GoalType): [string, string, string] {
    switch (goalType) {
        case "academic":
            return ["Focus Block", "Practice Block", "Review Block"];
        case "fitness":
            return ["Warm-up Block", "Workout Block", "Cool-down Block"];
        case "habit":
            return ["Trigger Setup", "Habit Practice", "Evening Check-in"];
        case "creative":
            return ["Creation Block", "Draft Block", "Polish Block"];
        case "health":
            return ["Nutrition Block", "Movement Block", "Recovery Block"];
        default:
            return ["Priority Block", "Execution Block", "Wrap-up Block"];
    }
}

function getFallbackPlanTitle(aimText: string, goalType: GoalType): string {
    const shortAim = aimText.replace(/\s+/g, " ").trim().slice(0, 36);
    const insight = analyzeAimInsight(aimText, goalType);
    const intentLabel =
        insight.intent === "stabilize" ? "Stability"
            : insight.intent === "build_consistency" ? "Consistency"
                : insight.intent === "recover_balance" ? "Recovery"
                    : insight.intent === "clarify_direction" ? "Clarity"
                        : "Performance";
    const prefix =
        goalType === "fitness" ? "7-Day Fitness Direction"
            : goalType === "habit" ? "7-Day Habit Direction"
                : goalType === "creative" ? "7-Day Creative Direction"
                    : goalType === "health" ? "7-Day Health Direction"
                        : goalType === "academic" ? "7-Day Academic Direction"
                            : "7-Day Goal Direction";
    return `${prefix} (${intentLabel}): ${shortAim}`;
}

function buildExecutionScheduleLines(
    aimText: string,
    blocks: [string, string, string],
    durations: BlockDurations,
    dailyTarget: DailyTarget | null,
    insight: AimInsight
): string[] {
    const [block1, block2, block3] = blocks;
    const primaryTheme = insight.themes[0] ?? "productivity";
    const strategy = getThemeStrategy(primaryTheme);

    if (dailyTarget) {
        const partitions = buildTargetPartitions(dailyTarget);
        const firstPartition = partitions[0]!;
        const secondPartition = partitions[1] ?? partitions[0]!;

        return [
            `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.setup}; complete ${formatPartitionRange(dailyTarget, firstPartition)} for "${aimText}"`,
            `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.execution}; complete ${formatPartitionRange(dailyTarget, secondPartition)}`,
            `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): ${strategy.review}; capture proof for today's target`,
        ];
    }

    return [
        `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.setup}; launch highest-priority action for "${aimText}"`,
        `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.execution}; push measurable progress sprint`,
        `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): ${strategy.review}; set tomorrow's adjustment`,
    ];
}

function buildReviewScheduleLines(
    aimText: string,
    blocks: [string, string, string],
    durations: BlockDurations,
    dailyTarget: DailyTarget | null,
    insight: AimInsight
): string[] {
    const [block1, block2, block3] = blocks;
    const primaryTheme = insight.themes[0] ?? "productivity";
    const strategy = getThemeStrategy(primaryTheme);

    if (dailyTarget) {
        return [
            `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): audit completion against ${formatDailyTarget(dailyTarget)} and map failures`,
            `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.execution}; revisit weakest ${dailyTarget.unitPlural}`,
            `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): ${strategy.review}; define next week's partition plan`,
        ];
    }

    return [
        `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): collect outputs for "${aimText}" from Days 1-6`,
        `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): ${strategy.execution}; finish highest-impact unfinished work`,
        `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): ${strategy.review}; choose next-week carry-forward actions`,
    ];
}

function buildExecutionTasks(
    aimText: string,
    dailyTarget: DailyTarget | null,
    insight: AimInsight,
    day: number
): string[] {
    const primaryTheme = insight.themes[0] ?? "productivity";
    const themeLabel = formatThemeLabel(primaryTheme);
    const strategy = getThemeStrategy(primaryTheme);

    if (dailyTarget) {
        return [
            `Hit today's target: ${formatDailyTarget(dailyTarget)} using both focus blocks.`,
            `Track proof per partition: count completed, skipped, and why (${themeLabel}).`,
            `Use ${strategy.review} to write one blocker and one concrete fix for tomorrow.`,
        ];
    }

    const dayChallenge =
        day === 1 ? "baseline measurement"
            : day === 2 ? "environment lock-in"
                : day === 3 ? "stability checkpoint"
                    : day === 4 ? "intensity increase"
                        : day === 5 ? "friction removal"
                            : "consolidation test";

    if (primaryTheme === "phone-distraction") {
        return [
            "Set social apps cap to 60 minutes for today and enable app blocking during focus blocks.",
            "Run 2 phone-out-of-reach focus blocks and log total deep-work minutes.",
            `Track unlock count tonight and reduce it by at least 10% vs yesterday (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "focus") {
        return [
            `Define one concrete output for "${aimText}" and complete 2 single-task blocks with no tab switching.`,
            "Use a distraction capture list; record every interruption instead of context switching.",
            `Log completion ratio (planned vs done) and target at least 70% (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "sleep") {
        return [
            "Set a no-screen cutoff 45 minutes before bed and commit to it tonight.",
            "Run a 15-minute wind-down routine (light stretch + next-day plan).",
            `Record bedtime and wake time; target at least 7h total sleep (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "stress") {
        return [
            "Run two 3-minute decompression resets (breath + posture) before major tasks.",
            "Limit today to top 3 priorities and complete #1 before midday.",
            `Rate stress morning/evening (1-10) and write one trigger-response correction (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "procrastination") {
        return [
            "Start the hardest task with a 5-minute entry action within the first working hour.",
            "Run 2 timed sprints before opening low-value apps/sites.",
            `Log the delay trigger and apply one friction fix immediately (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "energy") {
        return [
            "Drink 500ml water and complete a 5-minute movement warm-up before first focus block.",
            `Do one high-impact task while energy is highest and finish one measurable output for "${aimText}".`,
            `Score energy 3 times today (1-10) and adjust workload after any score below 5 (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "emotional-regulation") {
        return [
            "Do a 3-minute grounding reset before first work block and once when emotion spikes.",
            `Write one emotion label plus one useful action before continuing work on "${aimText}".`,
            `End day with a 5-line reflection (trigger, thought, action, outcome, adjustment) (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "planning") {
        return [
            "Set top 3 outcomes with realistic effort limits before you begin.",
            "Execute tasks in planned order and defer new tasks to a capture list.",
            `Run a plan-vs-actual review at end of day and move one task realistically (${dayChallenge}).`,
        ];
    }
    if (primaryTheme === "confidence") {
        return [
            "Write one evidence line from past success before starting today's hardest task.",
            "Complete one meaningful challenge action and save a proof artifact.",
            `Log one win signal and one skill gap with a next practice step (${dayChallenge}).`,
        ];
    }

    return [
        `Finish one measurable milestone for "${aimText}" with clear done criteria.`,
        "Run 2 focus blocks and track delivered output (count, note, or artifact).",
        `Write one adjustment tied to ${themeLabel} using today's measured results (${dayChallenge}).`,
    ];
}

function buildReviewTasks(dailyTarget: DailyTarget | null, insight: AimInsight): string[] {
    const primaryTheme = insight.themes[0] ?? "productivity";
    const themeLabel = formatThemeLabel(primaryTheme);

    if (dailyTarget) {
        return [
            `Measure weekly completion against ${formatDailyTarget(dailyTarget)}.`,
            "Identify where partition size or pace failed.",
            `Set next week's target with improved partition sizing and a ${themeLabel} safeguard.`,
        ];
    }

    return [
        "Measure completion against the 7-day aim.",
        `List what worked and what blocked progress in ${themeLabel}.`,
        "Set one clear measurable adjustment for the next 7 days.",
    ];
}

function buildFallbackDays(aimText: string, goalType: GoalType): DayPlan[] {
    const blocks = getGoalBlocks(goalType);
    const durations = getFallbackDurations(goalType);
    const dailyTarget = parseDailyTarget(aimText);
    const insight = analyzeAimInsight(aimText, goalType);
    const primaryThemeLabel = formatThemeLabel(insight.themes[0] ?? "productivity");

    const totalActiveMinutes = durations.focusMinutes * 2 + durations.reviewMinutes;
    const totalRestMinutes = durations.breakMinutes * 2 + durations.reviewBreakMinutes;
    const estimatedTime = `${formatMinutes(totalActiveMinutes)} | Rest: ${formatMinutes(totalRestMinutes)}`;

    return Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        const isReviewDay = day === 7;
        const baseFocus =
            day === 1 ? "Setup and baseline"
                : day === 2 ? "Build execution rhythm"
                    : day === 3 ? "Checkpoint and corrections"
                        : day === 4 ? "Consistency under pressure"
                            : day === 5 ? "Refine technique"
                                : day === 6 ? "Consolidate gains"
                                    : "Consolidate and evaluate";
        const focus = `${baseFocus} (${primaryThemeLabel})`;

        const schedule = isReviewDay
            ? buildReviewScheduleLines(aimText, blocks, durations, dailyTarget, insight)
            : buildExecutionScheduleLines(aimText, blocks, durations, dailyTarget, insight);

        const tasks = isReviewDay
            ? buildReviewTasks(dailyTarget, insight)
            : buildExecutionTasks(aimText, dailyTarget, insight, day);

        return {
            day,
            focus,
            schedule,
            tasks,
            estimatedTime,
        };
    });
}

function buildFallbackCore(aimText: string): NormalizedPlan {
    const goalType = detectGoalType(aimText);
    const insight = analyzeAimInsight(aimText, goalType);
    const primaryTheme = insight.themes[0] ?? "productivity";
    const planTitle = getFallbackPlanTitle(aimText, goalType);
    const days = buildFallbackDays(aimText, goalType);

    return {
        planTitle,
        days,
        checkpoints: {
            day3: `Check output quality and effort consistency for ${primaryTheme}. If progress is weak, reduce scope and tighten environment controls.`,
            day7: `Compare Day 1 baseline vs Day 7 results for ${primaryTheme}. Keep one winning pattern and remove one recurring blocker.`,
        },
        ifYouMissDay: "Do not restart the full week. Run one 30-minute recovery block tomorrow, complete the most critical pending action, then continue with the next plan day.",
    };
}

function buildPlanRaw(normalized: NormalizedPlan): string {
    const lines: string[] = [`Title: ${normalized.planTitle}`, ""];

    normalized.days.forEach((day) => {
        lines.push(`Day ${day.day}:`);
        lines.push(`Focus: ${day.focus}`);

        if (day.schedule && day.schedule.length > 0) {
            lines.push("Flexible Blocks:");
            day.schedule.forEach((line) => lines.push(line));
        }

        if (day.tasks.length > 0) {
            lines.push("Tasks:");
            day.tasks.forEach((task) => lines.push(`- ${task}`));
        }

        const time = splitEstimatedTime(day.estimatedTime);
        if (time.active) {
            lines.push(`Total Active Time: ${time.active}`);
        }
        if (time.rest) {
            lines.push(`Total Rest: ${time.rest}`);
        }
        lines.push("");
    });

    lines.push("Checkpoint (Day 3):");
    lines.push(normalized.checkpoints.day3);
    lines.push("");
    lines.push("Checkpoint (Day 7):");
    lines.push(normalized.checkpoints.day7);
    lines.push("");
    lines.push("If You Miss a Day:");
    lines.push(normalized.ifYouMissDay);

    return lines.join("\n").trim();
}

function buildPlanPrompt(aimText: string, ctx: BehavioralContext, retry = false): string {
    const goalType = detectGoalType(aimText);
    const insight = analyzeAimInsight(aimText, goalType);
    const primaryTheme = insight.themes[0] ?? "productivity";
    const energyLabel = ctx.avgEnergy < 2 ? "low" : ctx.avgEnergy < 3.5 ? "moderate" : "high";
    const stressLabel = ctx.avgStress > 2.5 ? "high" : ctx.avgStress > 1.5 ? "moderate" : "low";
    const focusLabel = ctx.avgFocus < 2 ? "scattered" : ctx.avgFocus < 3 ? "moderate" : "deep";
    const screenLabel = ctx.avgScreenTime > 6 ? "high (6+ h/day)" : `${ctx.avgScreenTime.toFixed(1)} h/day`;

    const sessionLen = ctx.avgFocus < 2 ? 20 : ctx.avgFocus < 3 ? 25 : 35;
    const breakLen = ctx.avgStress > 2.5 ? 10 : 5;
    const reviewLen = Math.max(15, sessionLen - 5);
    const detectedTarget = parseDailyTarget(aimText);
    const targetHint = detectedTarget
        ? `Detected numeric daily target: ${formatDailyTarget(detectedTarget)}.`
        : "No explicit numeric daily quantity was detected.";
    const toneGuidance = getToneSupportInstruction(insight.tone);
    const contextRisks: string[] = [];
    if (ctx.avgSleep < 6.5) contextRisks.push("sleep debt risk");
    if (ctx.avgScreenTime > 6) contextRisks.push("digital overload risk");
    if (ctx.avgStress > 2.5) contextRisks.push("high stress recovery risk");
    if (ctx.avgFocus < 2.2) contextRisks.push("attention fragmentation risk");
    if (ctx.avgEnergy < 2.2) contextRisks.push("low energy pacing risk");
    const riskLine = contextRisks.length > 0 ? contextRisks.join(", ") : "no acute risk spike detected";

    return `You are BECOMING, a behavioral planning system.
Create a practical, personalized 7-day performance-coaching plan from the exact user input.
Return ONLY valid JSON. No markdown. No explanations.

JSON schema:
{
  "planTitle": "string",
  "days": [
    {
      "day": 1,
      "focus": "string",
      "schedule": ["Block 1 (Block Name - Focus 35m + Break 10m): exact action"],
      "tasks": ["measurable task", "measurable task", "measurable task"],
      "totalActiveTime": "string",
      "totalRest": "string"
    }
  ],
  "checkpoints": {
    "day3": "2-3 sentences",
    "day7": "2-3 sentences"
  },
  "ifYouMissDay": "2-3 sentences"
}

Critical constraints:
- Exactly 7 day objects with day = 1..7.
- Each day must include 3-5 schedule lines and exactly 3 tasks.
- Do not output wall-clock schedules. No HH:MM ranges and no AM/PM times.
- Every schedule line must include focus duration and break duration in minutes.
- Use goal-specific block names; avoid generic labels like "Session 1".
- Never assume an academic goal unless the aim explicitly asks for study/exam work.
- For non-academic goals, do not use chapter/revision/exam/subject/homework language.
- If the aim includes a numeric daily target (example: "4 chapters a day"), partition that quantity across 2-3 blocks and label each partition clearly.
- Avoid generic coaching statements like "stay positive", "do your best", or "be consistent".
- Every task must be specific and measurable with a clear output, count, or completion signal.
- Use a supportive coaching tone: direct, calm, and practical.

Behavioral adaptation:
- Typical focus block length: ${sessionLen} minutes.
- Typical review block length: ${reviewLen} minutes.
- Typical break length: ${breakLen} minutes.
- Low energy: keep daily active effort under 2 hours.
- High stress: include one decompression block daily.
- Scattered focus: single-task blocks only.
- High screen time: include a clear screen-free block.

Planning intelligence requirements:
- First infer emotional tone and user intent from input.
- Identify 1-3 core themes and make them visible in day focuses/tasks.
- Day progression must be strategic:
  Day 1 reset/baseline, Day 2 environment design, Day 3 stabilization check,
  Day 4 intensity increase, Day 5 friction removal, Day 6 consolidation, Day 7 review + next-week bridge.
- Include at least one mindset shift or reflection prompt daily, but it must be actionable (not motivational fluff).
- Each day should include one "proof of execution" element (what user will track).

User aim: "${aimText}"
Target hint: ${targetHint}
Detected goal type: ${goalType}
Detected emotional tone: ${insight.tone}
Detected intent: ${insight.intent}
Detected themes: ${insight.themes.join(", ")}
Primary theme: ${primaryTheme}
Tone guidance: ${toneGuidance}
Behavioral context:
- Energy: ${energyLabel} (${ctx.avgEnergy.toFixed(1)}/5)
- Stress: ${stressLabel} (${ctx.avgStress.toFixed(1)}/4)
- Focus: ${focusLabel} (${ctx.avgFocus.toFixed(1)}/4)
- Sleep: ${ctx.avgSleep.toFixed(1)} h/night
- Screen time: ${screenLabel}
- Common struggle: ${ctx.commonStruggle || "not identified"}
- Mood: ${ctx.avgMood.toFixed(1)}/5
- Risk summary: ${riskLine}

${retry ? "Retry mode: verify JSON syntax carefully and return a single valid JSON object only." : ""}`.trim();
}

function buildReflectionPrompt(
    aimText: string,
    completionResult: "yes" | "partially" | "no",
    ctx: BehavioralContext
): string {
    const resultLabel =
        completionResult === "yes" ? "fully completed"
            : completionResult === "partially" ? "partially completed"
                : "not completed";

    return `You are BECOMING - a behavioral intelligence system. Generate a 3-5 line behavioral reflection summary for a user who ${resultLabel} their 7-day aim.

Aim: "${aimText}"
Behavioral data: mood avg ${ctx.avgMood.toFixed(1)}/5, energy ${ctx.avgEnergy.toFixed(1)}/5, focus ${ctx.avgFocus.toFixed(1)}/4, stress ${ctx.avgStress.toFixed(1)}/4, sleep ${ctx.avgSleep.toFixed(1)}h, screen time ${ctx.avgScreenTime.toFixed(1)}h/day.

Rules:
- 3-5 lines only
- Calm, data-aware tone with no motivational phrases
- Acknowledge what happened realistically
- End with one precise next behavioral suggestion
- Do not use the word "journey"`;
}

function extractJsonObject(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
        return fenceMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1).trim();
    }

    return trimmed;
}

function parseJsonWithRepairs(jsonText: string): unknown {
    const candidates = Array.from(new Set([
        jsonText,
        jsonText
            .replace(/[\u201C\u201D]/g, "\"")
            .replace(/[\u2018\u2019]/g, "'"),
        jsonText.replace(/,\s*([}\]])/g, "$1"),
        jsonText
            .replace(/[\u201C\u201D]/g, "\"")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/,\s*([}\]])/g, "$1"),
    ]));

    let lastErr: unknown = null;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (err) {
            lastErr = err;
        }
    }

    throw lastErr instanceof Error ? lastErr : new Error("Failed to parse plan JSON.");
}

function parseStructuredPlan(raw: string): StructuredPlanPayload {
    const jsonText = extractJsonObject(raw);
    const parsed = parseJsonWithRepairs(jsonText);

    if (!parsed || typeof parsed !== "object") {
        throw new Error("Gemini did not return a valid JSON plan object.");
    }

    return parsed as StructuredPlanPayload;
}

function estimateTimesFromBlocks(schedule: string[]): { active: string; rest: string } {
    let activeMinutes = 0;
    let restMinutes = 0;

    schedule.forEach((line) => {
        const focusMatch = line.match(/\bfocus\s*(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
        const breakMatch = line.match(/\bbreak\s*(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);

        if (focusMatch?.[1]) {
            activeMinutes += Number(focusMatch[1]);
        }
        if (breakMatch?.[1]) {
            restMinutes += Number(breakMatch[1]);
        }
    });

    return {
        active: activeMinutes > 0 ? formatMinutes(activeMinutes) : "",
        rest: restMinutes > 0 ? formatMinutes(restMinutes) : "",
    };
}

function isGenericTask(task: string): boolean {
    return GENERIC_TASK_PATTERNS.some((pattern) => pattern.test(task));
}

function hasMeasurableSignal(text: string): boolean {
    return MEASURABLE_SIGNAL_REGEX.test(text);
}

function extractAimKeywords(aimText: string): string[] {
    const stopwords = new Set([
        "that", "this", "with", "from", "have", "want", "need", "into", "your",
        "will", "just", "really", "very", "much", "more", "less", "about", "feel",
        "make", "goal", "week", "days", "day", "improve", "better", "toward",
    ]);

    return Array.from(
        new Set(
            aimText
                .toLowerCase()
                .split(/\W+/)
                .map((w) => w.trim())
                .filter((w) => w.length >= 4 && !stopwords.has(w))
        )
    ).slice(0, 8);
}

function buildThemeKeywordSet(themes: ProblemTheme[]): string[] {
    const themeKeywords: Record<ProblemTheme, string[]> = {
        "phone-distraction": ["phone", "screen", "social", "scroll", "digital"],
        focus: ["focus", "deep", "attention", "distraction", "single-task"],
        sleep: ["sleep", "bedtime", "wake", "rest", "wind-down"],
        stress: ["stress", "decompress", "calm", "breath", "recovery"],
        procrastination: ["start", "delay", "procrastination", "first step", "time-box"],
        energy: ["energy", "fatigue", "hydration", "movement", "activation"],
        "emotional-regulation": ["emotion", "mood", "trigger", "grounding", "journal"],
        planning: ["plan", "priority", "sequence", "schedule", "review"],
        confidence: ["confidence", "evidence", "challenge", "self-doubt", "wins"],
        productivity: ["output", "deliverable", "complete", "progress", "execution"],
    };

    return Array.from(new Set(themes.flatMap((theme) => themeKeywords[theme] ?? [])));
}

function countMatchingLines(lines: string[], keywords: string[]): number {
    if (keywords.length === 0) return 0;
    return lines.filter((line) => {
        const lower = line.toLowerCase();
        return keywords.some((keyword) => lower.includes(keyword));
    }).length;
}

function normalizeStructuredPlan(input: StructuredPlanPayload, aimText: string): NormalizedPlan {
    const fallback = buildFallbackCore(aimText);
    const planTitle = sanitizeText(input.planTitle, fallback.planTitle);
    const daysInput = Array.isArray(input.days) ? input.days : [];
    const dayMap = new Map<number, DayPlan>();

    daysInput.forEach((rawDay) => {
        if (!rawDay || typeof rawDay !== "object") return;
        const dayValue = (rawDay as StructuredPlanDay).day;
        const dayNum = Number(dayValue);
        if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 7) return;

        const fallbackDay = fallback.days[dayNum - 1];
        const focus = sanitizeText((rawDay as StructuredPlanDay).focus, fallbackDay.focus);
        const fallbackSchedule = fallbackDay.schedule ?? [];
        const scheduleFromModel = sanitizeList((rawDay as StructuredPlanDay).schedule)
            .slice(0, 8)
            .map((line, index) => {
                const fallbackLine = fallbackSchedule.length > 0
                    ? fallbackSchedule[index % fallbackSchedule.length]
                    : `Block ${index + 1} (Focus 25m + Break 5m): fallback task`;
                return normalizeModelBlockLine(line, index + 1, fallbackLine);
            })
            .filter((line) => line.length > 0)
            .slice(0, 8);

        const normalizedSchedule = [...scheduleFromModel];
        while (
            normalizedSchedule.length < MIN_SCHEDULE_LINES &&
            fallbackDay.schedule &&
            fallbackDay.schedule.length > 0
        ) {
            normalizedSchedule.push(
                fallbackDay.schedule[normalizedSchedule.length % fallbackDay.schedule.length]
            );
        }

        const tasksFromModel = sanitizeList((rawDay as StructuredPlanDay).tasks).slice(0, 6);
        const normalizedTasks = [...tasksFromModel];
        while (normalizedTasks.length < MIN_TASKS_PER_DAY) {
            normalizedTasks.push(fallbackDay.tasks[normalizedTasks.length % fallbackDay.tasks.length]);
        }

        const fallbackTime = splitEstimatedTime(fallbackDay.estimatedTime);
        const estimatedFromBlocks = estimateTimesFromBlocks(normalizedSchedule);
        const totalActiveTime = sanitizeText(
            (rawDay as StructuredPlanDay).totalActiveTime,
            estimatedFromBlocks.active || fallbackTime.active || "~1 hour"
        );
        const totalRest = sanitizeText(
            (rawDay as StructuredPlanDay).totalRest,
            estimatedFromBlocks.rest || fallbackTime.rest
        );
        const estimatedTime = totalRest
            ? `${totalActiveTime} | Rest: ${totalRest}`
            : totalActiveTime;

        dayMap.set(dayNum, {
            day: dayNum,
            focus,
            schedule: normalizedSchedule,
            tasks: normalizedTasks,
            estimatedTime,
        });
    });

    const days: DayPlan[] = [];
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
        days.push(dayMap.get(dayNum) ?? fallback.days[dayNum - 1]);
    }

    const checkpointsRaw = (input.checkpoints && typeof input.checkpoints === "object")
        ? (input.checkpoints as { day3?: unknown; day7?: unknown })
        : {};

    return {
        planTitle,
        days,
        checkpoints: {
            day3: sanitizeText(checkpointsRaw.day3, fallback.checkpoints.day3),
            day7: sanitizeText(checkpointsRaw.day7, fallback.checkpoints.day7),
        },
        ifYouMissDay: sanitizeText(input.ifYouMissDay, fallback.ifYouMissDay),
    };
}

function isValidDirectionPlan(days: DayPlan[], aimText: string): boolean {
    if (days.length !== 7) return false;

    const goalType = detectGoalType(aimText);
    const insight = analyzeAimInsight(aimText, goalType);
    const relevanceKeywords = Array.from(
        new Set([
            ...extractAimKeywords(aimText),
            ...buildThemeKeywordSet(insight.themes),
        ])
    );

    const allLines = days.flatMap((day) => [day.focus, ...day.tasks, ...(day.schedule ?? [])]);
    const relevanceHits = countMatchingLines(allLines, relevanceKeywords);
    const measurableTaskDays = days.filter((day) => day.tasks.some((task) => hasMeasurableSignal(task))).length;
    const accountabilityDays = days.filter((day) =>
        day.tasks.some((task) => /\b(log|track|record|measure|proof|count|audit)\b/i.test(task))
    ).length;
    const weakTaskCount = days.reduce(
        (sum, day) => sum + day.tasks.filter((task) => isGenericTask(task) || task.length < 14).length,
        0
    );

    return (
        days.every((day) =>
            day.day >= 1 &&
            day.day <= 7 &&
            day.focus.trim().length > 0 &&
            day.tasks.length >= MIN_TASKS_PER_DAY &&
            (day.schedule?.length ?? 0) >= MIN_SCHEDULE_LINES &&
            (day.schedule ?? []).every((line) => hasDurationAndBreak(line))
        ) &&
        weakTaskCount === 0 &&
        measurableTaskDays >= 6 &&
        accountabilityDays >= 4 &&
        relevanceHits >= 10
    );
}

async function callGemini(prompt: string, options: GeminiGenerationOptions = {}): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
        const res = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                prompt,
                options,
            }),
        });

        if (!res.ok) {
            let message = `AI route error ${res.status}`;
            try {
                const err = await res.json();
                if (typeof err?.error === "string" && err.error.trim()) {
                    message = err.error;
                }
            } catch {
                // Keep fallback message.
            }
            throw new Error(message);
        }

        const data = await res.json();
        const text: string = data?.text ?? "";
        if (!text) {
            throw new Error("AI route returned empty response.");
        }

        return text;
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new Error("AI request timed out after 55 seconds.");
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

export async function generateDirectionPlan(
    aimText: string,
    ctx: BehavioralContext
): Promise<DirectionPlan> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < PLAN_RETRY_OPTIONS.length; attempt++) {
        const retry = attempt > 0;
        try {
            const prompt = buildPlanPrompt(aimText, ctx, retry);
            const raw = await callGemini(prompt, PLAN_RETRY_OPTIONS[attempt]);
            const structured = parseStructuredPlan(raw);
            const normalized = normalizeStructuredPlan(structured, aimText);

            if (!isValidDirectionPlan(normalized.days, aimText)) {
                throw new Error("Generated plan failed validation.");
            }

            return {
                planTitle: normalized.planTitle,
                planRaw: buildPlanRaw(normalized),
                days: normalized.days,
            };
        } catch (err) {
            lastError = err;
            console.error(`[Gemini] Plan generation attempt ${attempt + 1} failed:`, err);
        }
    }

    throw (
        lastError instanceof Error
            ? lastError
            : new Error("Failed to generate a valid 7-day plan.")
    );
}

/** Fallback plan used when Gemini is unavailable or invalid. */
export function buildFallbackPlan(aimText: string): DirectionPlan {
    const normalized = buildFallbackCore(aimText);
    return {
        planTitle: normalized.planTitle,
        planRaw: buildPlanRaw(normalized),
        days: normalized.days,
    };
}

export async function generateReflectionSummary(
    aimText: string,
    completionResult: "yes" | "partially" | "no",
    ctx: BehavioralContext
): Promise<string> {
    const prompt = buildReflectionPrompt(aimText, completionResult, ctx);
    return await callGemini(prompt);
}

/** Compute behavioral context from the last N entries. */
export function computeBehavioralContext(
    entries: Array<{
        answers: {
            mood?: string;
            energy?: string;
            focus?: string;
            stress?: string;
            sleepHours?: number;
            screenTimeHours?: number;
            struggle?: string;
        };
    }>
): BehavioralContext {
    if (entries.length === 0) {
        return {
            avgMood: 3,
            avgEnergy: 3,
            avgFocus: 2,
            avgStress: 2,
            avgSleep: 7,
            avgScreenTime: 4,
            commonStruggle: "not identified",
        };
    }

    const MOOD_MAP: Record<string, number> = {
        "Very Low": 1, Low: 2, Good: 3, "Very Good": 4, Excellent: 5,
    };
    const ENERGY_MAP: Record<string, number> = {
        Drained: 1, Low: 2, Balanced: 3, High: 4, Powerful: 5,
    };
    const FOCUS_MAP: Record<string, number> = {
        Distracted: 1, Normal: 2, Focused: 3, "Deep Focus": 4,
    };
    const STRESS_MAP: Record<string, number> = {
        Calm: 1, Slight: 2, Stressed: 3, Overwhelmed: 4,
    };

    const avg = (nums: number[]) =>
        nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

    const moodNums = entries.map((e) => MOOD_MAP[e.answers.mood ?? ""] ?? 3);
    const energyNums = entries.map((e) => ENERGY_MAP[e.answers.energy ?? ""] ?? 3);
    const focusNums = entries.map((e) => FOCUS_MAP[e.answers.focus ?? ""] ?? 2);
    const stressNums = entries.map((e) => STRESS_MAP[e.answers.stress ?? ""] ?? 2);
    const sleepNums = entries.map((e) => e.answers.sleepHours ?? 7);
    const screenNums = entries.map((e) => e.answers.screenTimeHours ?? 4);

    const words: Record<string, number> = {};
    entries.forEach((e) => {
        const s = (e.answers.struggle ?? "").toLowerCase();
        s.split(/\W+/).forEach((w) => {
            if (w.length > 3) words[w] = (words[w] ?? 0) + 1;
        });
    });

    const commonStruggle =
        Object.entries(words).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "not identified";

    return {
        avgMood: avg(moodNums),
        avgEnergy: avg(energyNums),
        avgFocus: avg(focusNums),
        avgStress: avg(stressNums),
        avgSleep: avg(sleepNums),
        avgScreenTime: avg(screenNums),
        commonStruggle,
    };
}
