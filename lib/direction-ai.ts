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

const PLAN_RETRY_OPTIONS: GeminiGenerationOptions[] = [
    { temperature: 0.35, maxOutputTokens: 4096, responseMimeType: "application/json" },
    { temperature: 0.2, maxOutputTokens: 4096 },
];

const MIN_TASKS_PER_DAY = 3;
const MIN_SCHEDULE_LINES = 3;
const DAILY_TARGET_REGEX = /(\d{1,3})\s*(chapter|chapters|page|pages|problem|problems|task|tasks|lesson|lessons|module|modules|video|videos|exercise|exercises|topic|topics|question|questions|set|sets|unit|units)\s*(?:(?:a|per)\s*day|\/\s*day|daily|every\s+day)\b/i;
const CLOCK_TIME_PREFIX_REGEX = /^\s*(?:\d{1,2}:\d{2}\s*[\-\u2013\u2014]\s*\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\s*[\-\u2013\u2014]\s*\d{1,2}\s*(?:am|pm))\s*[\-\u2013\u2014]?\s*/i;

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
    const prefix =
        goalType === "fitness" ? "7-Day Fitness Direction"
            : goalType === "habit" ? "7-Day Habit Direction"
                : goalType === "creative" ? "7-Day Creative Direction"
                    : goalType === "health" ? "7-Day Health Direction"
                        : goalType === "academic" ? "7-Day Academic Direction"
                            : "7-Day Goal Direction";
    return `${prefix}: ${shortAim}`;
}

function buildExecutionScheduleLines(
    aimText: string,
    blocks: [string, string, string],
    durations: BlockDurations,
    dailyTarget: DailyTarget | null
): string[] {
    const [block1, block2, block3] = blocks;

    if (dailyTarget) {
        const partitions = buildTargetPartitions(dailyTarget);
        const firstPartition = partitions[0]!;
        const secondPartition = partitions[1] ?? partitions[0]!;

        return [
            `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): complete ${formatPartitionRange(dailyTarget, firstPartition)} for "${aimText}"`,
            `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): complete ${formatPartitionRange(dailyTarget, secondPartition)} and check quality`,
            `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): active recall + error log for today's target`,
        ];
    }

    return [
        `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): highest-priority action for "${aimText}"`,
        `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): second measurable progress sprint`,
        `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): review outcome and set tomorrow's adjustment`,
    ];
}

function buildReviewScheduleLines(
    aimText: string,
    blocks: [string, string, string],
    durations: BlockDurations,
    dailyTarget: DailyTarget | null
): string[] {
    const [block1, block2, block3] = blocks;

    if (dailyTarget) {
        return [
            `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): audit completion against ${formatDailyTarget(dailyTarget)}`,
            `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): revisit weakest ${dailyTarget.unitPlural} and patch gaps`,
            `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): define next week's partition plan`,
        ];
    }

    return [
        `Block 1 (${block1} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): collect outputs for "${aimText}" from Days 1-6`,
        `Block 2 (${block2} - Focus ${durations.focusMinutes}m + Break ${durations.breakMinutes}m): finish top remaining high-impact work`,
        `Block 3 (${block3} - Focus ${durations.reviewMinutes}m + Break ${durations.reviewBreakMinutes}m): choose next-week carry-forward actions`,
    ];
}

function buildExecutionTasks(aimText: string, dailyTarget: DailyTarget | null): string[] {
    if (dailyTarget) {
        return [
            `Hit today's target: ${formatDailyTarget(dailyTarget)} using both focus blocks.`,
            "Track proof per partition (what was completed, what was skipped).",
            "Write one blocker and one concrete fix for tomorrow.",
        ];
    }

    return [
        `Complete one measurable action toward "${aimText}"`,
        "Log one proof artifact (count, note, or output).",
        "Write one adjustment for tomorrow.",
    ];
}

function buildReviewTasks(dailyTarget: DailyTarget | null): string[] {
    if (dailyTarget) {
        return [
            `Measure weekly completion against ${formatDailyTarget(dailyTarget)}.`,
            "Identify where partition size or pace failed.",
            "Set next week's target with improved partition sizing.",
        ];
    }

    return [
        "Measure completion against the 7-day aim.",
        "List what worked and what blocked progress.",
        "Set one clear adjustment for the next 7 days.",
    ];
}

function buildFallbackDays(aimText: string, goalType: GoalType): DayPlan[] {
    const blocks = getGoalBlocks(goalType);
    const durations = getFallbackDurations(goalType);
    const dailyTarget = parseDailyTarget(aimText);

    const totalActiveMinutes = durations.focusMinutes * 2 + durations.reviewMinutes;
    const totalRestMinutes = durations.breakMinutes * 2 + durations.reviewBreakMinutes;
    const estimatedTime = `${formatMinutes(totalActiveMinutes)} | Rest: ${formatMinutes(totalRestMinutes)}`;

    return Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        const isReviewDay = day === 7;
        const focus =
            day === 1 ? "Setup and baseline"
                : day === 2 ? "Build execution rhythm"
                    : day === 3 ? "Checkpoint and corrections"
                        : day === 4 ? "Consistency under pressure"
                            : day === 5 ? "Refine technique"
                                : day === 6 ? "Consolidate gains"
                                    : "Consolidate and evaluate";

        const schedule = isReviewDay
            ? buildReviewScheduleLines(aimText, blocks, durations, dailyTarget)
            : buildExecutionScheduleLines(aimText, blocks, durations, dailyTarget);

        const tasks = isReviewDay
            ? buildReviewTasks(dailyTarget)
            : buildExecutionTasks(aimText, dailyTarget);

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
    const planTitle = getFallbackPlanTitle(aimText, goalType);
    const days = buildFallbackDays(aimText, goalType);

    return {
        planTitle,
        days,
        checkpoints: {
            day3: "Check measurable output and effort consistency. If output is low, reduce scope and keep blocks smaller but non-zero.",
            day7: "Compare Day 1 baseline vs Day 7 results using your logged evidence. Keep what worked and remove one ineffective pattern.",
        },
        ifYouMissDay: "Do not restart the full week. Run one 30-minute recovery block tomorrow, then continue with the next plan day.",
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

    return `You are BECOMING, a behavioral planning system.
Create a practical 7-day plan for the exact user goal.
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
- No motivational fluff. Keep every action specific and measurable.

Behavioral adaptation:
- Typical focus block length: ${sessionLen} minutes.
- Typical review block length: ${reviewLen} minutes.
- Typical break length: ${breakLen} minutes.
- Low energy: keep daily active effort under 2 hours.
- High stress: include one decompression block daily.
- Scattered focus: single-task blocks only.
- High screen time: include a clear screen-free block.

User aim: "${aimText}"
Target hint: ${targetHint}
Behavioral context:
- Energy: ${energyLabel} (${ctx.avgEnergy.toFixed(1)}/5)
- Stress: ${stressLabel} (${ctx.avgStress.toFixed(1)}/4)
- Focus: ${focusLabel} (${ctx.avgFocus.toFixed(1)}/4)
- Sleep: ${ctx.avgSleep.toFixed(1)} h/night
- Screen time: ${screenLabel}
- Common struggle: ${ctx.commonStruggle || "not identified"}
- Mood: ${ctx.avgMood.toFixed(1)}/5

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

function parseStructuredPlan(raw: string): StructuredPlanPayload {
    const jsonText = extractJsonObject(raw);
    const parsed = JSON.parse(jsonText);

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

function isValidDirectionPlan(days: DayPlan[]): boolean {
    return (
        days.length === 7 &&
        days.every((day) =>
            day.day >= 1 &&
            day.day <= 7 &&
            day.focus.trim().length > 0 &&
            day.tasks.length >= MIN_TASKS_PER_DAY &&
            (day.schedule?.length ?? 0) >= MIN_SCHEDULE_LINES &&
            (day.schedule ?? []).every((line) => hasDurationAndBreak(line))
        )
    );
}

async function callGemini(prompt: string, options: GeminiGenerationOptions = {}): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

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
            throw new Error("AI request timed out after 35 seconds.");
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

            if (!isValidDirectionPlan(normalized.days)) {
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
