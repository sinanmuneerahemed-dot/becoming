"use client";

import { useState } from "react";
import type { CheckinStep } from "@/lib/checkin-questions";

interface CheckinQuestionProps {
  step: CheckinStep;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}

export function CheckinQuestion({
  step,
  value,
  onChange,
}: CheckinQuestionProps) {
  const [numError, setNumError] = useState<string>("");

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(0);
      setNumError("");
      return;
    }
    const num = parseFloat(raw);
    if (isNaN(num)) {
      setNumError("Enter a valid number");
      return;
    }
    const min = step.min ?? 0;
    const max = step.max ?? 24;
    if (num < min || num > max) {
      setNumError(`Must be between ${min} and ${max}`);
    } else {
      setNumError("");
    }
    onChange(num);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{step.question}</h2>

      {step.type === "number" && (
        <div>
          <input
            type="number"
            min={step.min}
            max={step.max}
            step={step.step}
            value={value ?? ""}
            onChange={handleNumberChange}
            className="w-full max-w-xs px-4 py-3 min-h-[48px] rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent text-base"
            placeholder={step.placeholder ?? "e.g., 7.5"}
          />
          {numError && <p className="mt-2 text-sm text-red-400">{numError}</p>}
        </div>
      )}

      {step.type === "radio" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {step.options?.map((opt) => (
            <label
              key={opt}
              className={`flex items-center justify-center p-3 min-h-[48px] rounded-lg border cursor-pointer transition-colors touch-manipulation text-sm sm:text-base ${
                value === opt
                  ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                  : "border-white/20 hover:border-white/40 text-white/80"
              }`}
            >
              <input
                type="radio"
                name={String(step.key)}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {step.type === "textarea" && (
        <div>
          <textarea
            value={value ?? ""}
            onChange={handleTextChange}
            rows={4}
            maxLength={step.maxLength ?? 300}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none text-base"
            placeholder={step.placeholder ?? "Your answer..."}
          />
          {step.maxLength && (
            <p className="mt-1 text-xs text-white/50">
              {String(value ?? "").length}/{step.maxLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
