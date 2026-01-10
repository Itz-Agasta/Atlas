"use client";

/** FIXME: we have to fix this later.
 * currently we are using the ui/TimePeriodSelector.tsx ...*/
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TIME_PERIODS = [
  { value: "5d", label: "5D" },
  { value: "10d", label: "10D" },
  { value: "30d", label: "30D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

interface TimePeriodFilterProps {
  value: string;
  customRange?: { start: Date; end: Date };
  onTimePeriodChange: (
    period: string,
    customRange?: { start: Date; end: Date },
  ) => void;
}

export function TimePeriodFilter({
  value,
  customRange,
  onTimePeriodChange,
}: TimePeriodFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(
    customRange?.start,
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(
    customRange?.end,
  );

  const handlePeriodChange = (newValue: string) => {
    if (newValue && newValue !== "custom") {
      onTimePeriodChange(newValue);
      setIsCustomOpen(false);
    } else if (newValue === "custom") {
      setIsCustomOpen(true);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onTimePeriodChange("custom", { start: customStart, end: customEnd });
      setIsCustomOpen(false);
    }
  };

  const handleCustomCancel = () => {
    setCustomStart(customRange?.start);
    setCustomEnd(customRange?.end);
    setIsCustomOpen(false);
    if (value === "custom" && !customRange) {
      onTimePeriodChange("all");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4">
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={handlePeriodChange}
          className="grid grid-cols-6 gap-1 w-full"
        >
          {TIME_PERIODS.map((period) => (
            <ToggleGroupItem
              key={period.value}
              value={period.value}
              className="text-xs font-medium px-2 py-2 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label={`Select ${period.label} time period`}
            >
              {period.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Custom Date Range Picker */}
        {value === "custom" && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium text-foreground">
              Custom Date Range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-8 text-xs"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {customStart
                      ? format(customStart, "MMM dd, yyyy")
                      : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStart}
                    onSelect={setCustomStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-8 text-xs"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {customEnd ? format(customEnd, "MMM dd, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEnd}
                    onSelect={setCustomEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
                className="flex-1 h-7 text-xs"
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCustomCancel}
                className="flex-1 h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Display current custom range if set */}
        {value === "custom" && customRange && !isCustomOpen && (
          <div className="mt-3 p-2 bg-muted rounded text-xs">
            <span className="font-medium">Selected:</span>{" "}
            {format(customRange.start, "MMM dd, yyyy")} -{" "}
            {format(customRange.end, "MMM dd, yyyy")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
