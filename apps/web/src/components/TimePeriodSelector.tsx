"use client";

import { useState } from "react";
import { FaClock } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          type="single"
          value={selectedPeriod}
          onValueChange={handleValueChange}
          className="grid grid-cols-5 gap-1 w-full"
        >
          {TIME_PERIODS.map((period) => (
            <ToggleGroupItem
              key={period.value}
              value={period.value}
              className="text-sm font-medium px-3 py-2 h-9 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label={`Select ${period.label} time period`}
            >
              {period.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
