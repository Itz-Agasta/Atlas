"use client";

/** FIXME: we have to fix this later.
 * currently we are using the ui/TimePeriodSelector.tsx ...*/
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
    customRange?: { start: Date; end: Date }
  ) => void;
}

export function TimePeriodFilter({
  value,
  customRange,
  onTimePeriodChange,
}: TimePeriodFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(
    customRange?.start
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(
    customRange?.end
  );

  // Sync local state when parent customRange prop changes
  useEffect(() => {
    setCustomStart(customRange?.start);
    setCustomEnd(customRange?.end);
  }, [customRange]);

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
      const normalizedStart = customStart < customEnd ? customStart : customEnd;
      const normalizedEnd = customStart > customEnd ? customStart : customEnd;
      onTimePeriodChange("custom", {
        start: normalizedStart,
        end: normalizedEnd,
      });
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
          className="grid w-full grid-cols-6 gap-1"
          onValueChange={handlePeriodChange}
          type="single"
          value={value}
        >
          {TIME_PERIODS.map((period) => (
            <ToggleGroupItem
              aria-label={`Select ${period.label} time period`}
              className="h-8 px-2 py-2 font-medium text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              key={period.value}
              value={period.value}
            >
              {period.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Custom Date Range Picker */}
        {value === "custom" && (
          <div className="mt-4 space-y-3">
            <div className="font-medium text-foreground text-sm">
              Custom Date Range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="h-8 w-full justify-start text-left font-normal text-xs"
                    variant="outline"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {customStart
                      ? format(customStart, "MMM dd, yyyy")
                      : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    initialFocus
                    mode="single"
                    onSelect={setCustomStart}
                    selected={customStart}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="h-8 w-full justify-start text-left font-normal text-xs"
                    variant="outline"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {customEnd ? format(customEnd, "MMM dd, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    initialFocus
                    mode="single"
                    onSelect={setCustomEnd}
                    selected={customEnd}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button
                className="h-7 flex-1 text-xs"
                disabled={!(customStart && customEnd)}
                onClick={handleCustomApply}
                size="sm"
              >
                Apply
              </Button>
              <Button
                className="h-7 flex-1 text-xs"
                onClick={handleCustomCancel}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Display current custom range if set */}
        {value === "custom" && customRange && !isCustomOpen && (
          <div className="mt-3 rounded bg-muted p-2 text-xs">
            <span className="font-medium">Selected:</span>{" "}
            {format(customRange.start, "MMM dd, yyyy")} -{" "}
            {format(customRange.end, "MMM dd, yyyy")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
