"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TIME_PERIODS = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

interface TimePeriodSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function TimePeriodSelector({
  value = "all",
  onValueChange,
}: TimePeriodSelectorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(value);

  useEffect(() => {
    if (value) {
      setSelectedPeriod(value);
    }
  }, [value]);

  const handleValueChange = (newValue: string) => {
    if (newValue) {
      setSelectedPeriod(newValue);
      onValueChange?.(newValue);
    }
  };

  return (
    <Card className="shadow-sm">
      {/* <CardHeader className="pb-4"> */}
      {/* <CardTitle className="text-lg flex items-center gap-3">
          <FaClock className="h-5 w-5 text-primary" />
          Time Period
        </CardTitle> */}
      {/* </CardHeader> */}
      <CardContent>
        <ToggleGroup
          className="grid w-full grid-cols-5 gap-1"
          onValueChange={handleValueChange}
          type="single"
          value={selectedPeriod}
        >
          {TIME_PERIODS.map((period) => (
            <ToggleGroupItem
              aria-label={`Select ${period.label} time period`}
              className="h-9 px-3 py-2 font-medium text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              key={period.value}
              value={period.value}
            >
              {period.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
