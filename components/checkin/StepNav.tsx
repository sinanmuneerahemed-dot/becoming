"use client";

import Link from "next/link";
import { NeonButton } from "@/components/ui/NeonButton";

interface StepNavProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export function StepNav({
  step,
  totalSteps,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
}: StepNavProps) {
  const isFirst = step === 1;
  const isLast = step === totalSteps;

  return (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mt-8">
      {isFirst ? (
        <Link href="/app">
          <NeonButton variant="ghost">Back to Dashboard</NeonButton>
        </Link>
      ) : (
        <Link href={`/checkin/${step - 1}`}>
          <NeonButton variant="ghost">Back</NeonButton>
        </Link>
      )}
      <NeonButton variant="primary" onClick={onNext} disabled={nextDisabled}>
        {isLast ? "Finish" : nextLabel}
      </NeonButton>
    </div>
  );
}
