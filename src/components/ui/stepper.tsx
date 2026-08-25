import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <ol className="flex w-full items-center">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && (isCompleted || index === currentStep);

        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center",
              index < steps.length - 1 && "flex-1",
            )}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(index)}
              className={cn(
                "group flex items-center gap-2",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-not-allowed",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  isCompleted && "border-emerald-500 bg-emerald-500 text-white",
                  isCurrent && "border-amber-500 bg-white text-amber-700",
                  !isCompleted && !isCurrent && "border-slate-200 bg-white text-slate-400",
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-sm",
                  isCurrent && "font-semibold text-amber-700",
                  isCompleted && "text-emerald-700",
                  !isCompleted && !isCurrent && "text-slate-400",
                )}
              >
                {step.title}
              </span>
            </button>

            {/* Línea conectora */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px flex-1 transition-colors",
                  index < currentStep ? "bg-emerald-500" : "bg-slate-200",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
