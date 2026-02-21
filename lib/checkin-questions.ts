import type { EntryAnswers } from "./firestore";

export interface CheckinStep {
  key: keyof EntryAnswers;
  question: string;
  type: "number" | "radio" | "textarea";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
  maxLength?: number;
}

export const CHECKIN_STEPS: CheckinStep[] = [
  {
    key: "mood",
    question: "How is your mood?",
    type: "radio",
    options: ["Very Low", "Low", "Good", "Very Good", "Excellent"],
  },
  {
    key: "energy",
    question: "How is your energy?",
    type: "radio",
    options: ["Drained", "Low", "Balanced", "High", "Powerful"],
  },
  {
    key: "focus",
    question: "How was your focus?",
    type: "radio",
    options: ["Distracted", "Normal", "Focused", "Deep Focus"],
  },
  {
    key: "stress",
    question: "How stressed do you feel?",
    type: "radio",
    options: ["Calm", "Slight", "Stressed", "Overwhelmed"],
  },
  {
    key: "sleepHours",
    question: "How many hours of sleep last night?",
    type: "number",
    min: 0,
    max: 24,
    step: 0.5,
    placeholder: "e.g., 7.5",
  },
  {
    key: "screenTimeHours",
    question: "How many hours of screen time today?",
    type: "number",
    min: 0,
    max: 24,
    step: 0.5,
    placeholder: "e.g., 4",
  },
  {
    key: "win",
    question: "What is one WIN from today?",
    type: "textarea",
    placeholder: "What is one WIN from today?",
    maxLength: 300,
  },
  {
    key: "struggle",
    question: "What challenged you today?",
    type: "textarea",
    placeholder: "What challenged you today?",
    maxLength: 300,
  },
];
