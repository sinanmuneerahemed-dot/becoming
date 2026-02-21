import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeEntryAnswers, type NormalizedAnswers } from "./entry-normalize";

export type EntryAnswers = NormalizedAnswers;

export interface EntryComputed {
  score: number;
  streak: number;
}

export interface Entry {
  id: string;
  date: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  answers: EntryAnswers;
  computed: EntryComputed;
}

export interface UserDoc {
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getOrCreateUser(
  uid: string,
  displayName: string | null,
  photoURL: string | null
): Promise<UserDoc> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as UserDoc;
  }

  const userDoc: UserDoc = {
    displayName,
    photoURL,
    createdAt: serverTimestamp() as Timestamp,
  };
  await setDoc(userRef, userDoc);
  return userDoc;
}

export async function getEntry(
  uid: string,
  dateStr: string
): Promise<Entry | null> {
  const entryRef = doc(db, "users", uid, "entries", dateStr);
  const snap = await getDoc(entryRef);

  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    id: snap.id,
    date: data.date,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    answers: normalizeEntryAnswers(data.answers),
    computed: data.computed ?? { score: 0, streak: 0 },
  } as Entry;
}

export async function saveEntry(
  uid: string,
  dateStr: string,
  answers: Partial<EntryAnswers>,
  isComplete: boolean = false
): Promise<void> {
  const entryRef = doc(db, "users", uid, "entries", dateStr);
  const snap = await getDoc(entryRef);

  const now = serverTimestamp();
  const base = snap.exists()
    ? (snap.data() as Partial<Entry>)
    : { date: dateStr, createdAt: now };

  const existingRaw = "answers" in base ? (base as { answers?: Record<string, unknown> }).answers : {};
  const existing = normalizeEntryAnswers(existingRaw);
  const mergedAnswers: EntryAnswers = {
    mood: (answers as Partial<EntryAnswers>).mood ?? existing.mood,
    energy: (answers as Partial<EntryAnswers>).energy ?? existing.energy,
    focus: (answers as Partial<EntryAnswers>).focus ?? existing.focus,
    stress: (answers as Partial<EntryAnswers>).stress ?? existing.stress,
    sleepHours: (answers as Partial<EntryAnswers>).sleepHours ?? existing.sleepHours,
    screenTimeHours: (answers as Partial<EntryAnswers>).screenTimeHours ?? existing.screenTimeHours,
    win: (answers as Partial<EntryAnswers>).win ?? existing.win,
    struggle: (answers as Partial<EntryAnswers>).struggle ?? existing.struggle,
  };

  let computed: EntryComputed;
  if (isComplete) {
    const score = computeScore(mergedAnswers);
    const streak = await computeStreak(uid, dateStr);
    computed = { score, streak };
  } else {
    computed = "computed" in base && base.computed ? base.computed : { score: 0, streak: 0 };
  }

  await setDoc(entryRef, {
    ...base,
    date: dateStr,
    answers: mergedAnswers,
    computed,
    updatedAt: now,
  });
}

export async function computeStreak(uid: string, upToDate: string): Promise<number> {
  const entriesRef = collection(db, "users", uid, "entries");
  const q = query(
    entriesRef,
    where("date", "<=", upToDate),
    orderBy("date", "desc"),
    limit(31)
  );
  const snap = await getDocs(q);
  const dates = snap.docs.map((d) => d.data().date as string).sort().reverse();

  let streak = 0;
  const target = new Date(upToDate);

  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const expected = new Date(target);
    expected.setDate(expected.getDate() - i);
    if (formatDate(d) === formatDate(expected)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function getLastNEntries(uid: string, n: number): Promise<Entry[]> {
  const entriesRef = collection(db, "users", uid, "entries");
  const q = query(
    entriesRef,
    orderBy("date", "desc"),
    limit(n)
  );
  const snap = await getDocs(q);

  const entries = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: data.date,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
      answers: data.answers ?? {},
      computed: data.computed ?? { score: 0, streak: 0 },
    } as Entry;
  });

  return entries.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface StoredInsight {
  windowStart: string;
  windowEnd: string;
  suggestions: string[];
  note: string;
  computedAt: Timestamp;
  entryCount: number;
}

export async function getInsightDoc(
  uid: string,
  type: "weekly" | "monthly"
): Promise<StoredInsight | null> {
  const ref = doc(db, "users", uid, "insights", type);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as StoredInsight;
}

export async function saveInsightDoc(
  uid: string,
  type: "weekly" | "monthly",
  data: Omit<StoredInsight, "computedAt"> & { computedAt?: Timestamp }
): Promise<void> {
  const ref = doc(db, "users", uid, "insights", type);
  await setDoc(ref, {
    ...data,
    computedAt: data.computedAt ?? serverTimestamp(),
  });
}

export async function getEntriesForRange(
  uid: string,
  startDate: string,
  endDate: string
): Promise<Entry[]> {
  const entriesRef = collection(db, "users", uid, "entries");
  const q = query(
    entriesRef,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: data.date,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
      answers: normalizeEntryAnswers(data.answers),
      computed: data.computed ?? { score: 0, streak: 0 },
    } as Entry;
  });
}

const FOCUS_SCORE: Record<string, number> = { Distracted: 1, Normal: 2, Focused: 3, "Deep Focus": 4 };
const MOOD_SCORE: Record<string, number> = { "Very Low": 1, Low: 2, Good: 3, "Very Good": 4, Excellent: 5 };

export function computeScore(answers: EntryAnswers): number {
  const focusNum = FOCUS_SCORE[answers.focus] ?? 2;
  const sleepHours = answers.sleepHours ?? 7;
  const screenHours = answers.screenTimeHours ?? 4;

  const focusScore = (focusNum / 4) * 40;
  const sleepScore = Math.min(sleepHours / 8, 1) * 30;
  const screenScore = Math.max(0, 30 - screenHours * 5);

  return Math.round(Math.min(100, Math.max(0, focusScore + sleepScore + screenScore)));
}

// â”€â”€â”€ 7-Day Direction System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DayPlan {
  day: number;
  focus: string;
  tasks: string[];
  estimatedTime: string;
  schedule?: string[]; // flexible action blocks e.g. "Block 1 (Focus 35m + Break 10m): exact task"
}

export interface WeeklyAim {
  id: string;
  aimText: string;
  startDate: string;
  endDate: string;
  createdAt: Timestamp | null;
  status: "active" | "completed";
  planRaw: string;
  planTitle: string;
  days: DayPlan[];
  completionResult?: "yes" | "partially" | "no";
  reflectionSummary?: string;
}

export async function saveWeeklyAim(
  uid: string,
  aim: Omit<WeeklyAim, "id" | "createdAt">
): Promise<string> {
  const aimsRef = collection(db, "users", uid, "weeklyAims");
  const docRef = await addDoc(aimsRef, {
    ...aim,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function closeActiveWeeklyAims(uid: string): Promise<number> {
  const aimsRef = collection(db, "users", uid, "weeklyAims");
  const q = query(aimsRef, where("status", "==", "active"));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      status: "completed",
      completionResult: "no",
      reflectionSummary: "Closed automatically after creating a newer 7-day aim.",
    });
  });
  await batch.commit();
  return snap.size;
}

export async function getActiveWeeklyAim(
  uid: string
): Promise<WeeklyAim | null> {
  const aimsRef = collection(db, "users", uid, "weeklyAims");
  const q = query(aimsRef, where("status", "==", "active"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs
    .slice()
    .sort((a, b) => {
      const aTs = (a.data().createdAt as Timestamp | null | undefined)?.toMillis?.() ?? 0;
      const bTs = (b.data().createdAt as Timestamp | null | undefined)?.toMillis?.() ?? 0;
      return bTs - aTs;
    })[0]!;
  return { id: d.id, ...d.data() } as WeeklyAim;
}

export async function completeWeeklyAim(
  uid: string,
  aimId: string,
  completionResult: "yes" | "partially" | "no",
  reflectionSummary: string
): Promise<void> {
  const ref = doc(db, "users", uid, "weeklyAims", aimId);
  await updateDoc(ref, {
    status: "completed",
    completionResult,
    reflectionSummary,
  });
}

export async function updateWeeklyAimPlan(
  uid: string,
  aimId: string,
  planRaw: string,
  planTitle: string,
  days: DayPlan[]
): Promise<void> {
  const ref = doc(db, "users", uid, "weeklyAims", aimId);
  await updateDoc(ref, { planRaw, planTitle, days });
}

