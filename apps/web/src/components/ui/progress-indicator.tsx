"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  title: string;
  value: number;
  showPercentage?: boolean;
  className?: string;
  progressClassName?: string;
}

const ProgressIndicator = React.forwardRef<
  HTMLDivElement,
  ProgressIndicatorProps
>(
  (
    {
      title,
      value,
      showPercentage = true,
      className,
      progressClassName,
      ...props
    },
    ref,
  ) => {
    const clampedValue = Math.max(0, Math.min(100, value));

    // Dynamic color based on value with more granular ranges
    const getProgressColor = () => {
      if (clampedValue >= 90) return "bg-emerald-500"; // Emerald for excellent (90-100%)
      if (clampedValue >= 80) return "bg-green-500"; // Green for very good (80-89%)
      if (clampedValue >= 70) return "bg-lime-500"; // Lime for good (70-79%)
      if (clampedValue >= 60) return "bg-yellow-500"; // Yellow for fair (60-69%)
      if (clampedValue >= 50) return "bg-orange-500"; // Orange for below average (50-59%)
      if (clampedValue >= 30) return "bg-red-500"; // Red for poor (30-49%)
      return "bg-rose-600"; // Dark red for critical (0-29%)
    };

    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{title}</h4>
          {showPercentage && (
            <span className="text-sm font-medium">
              {clampedValue.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cn(
              "h-full transition-all duration-300",
              getProgressColor(),
            )}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
      </div>
    );
  },
);

ProgressIndicator.displayName = "ProgressIndicator";

export { ProgressIndicator };
export type { ProgressIndicatorProps };
