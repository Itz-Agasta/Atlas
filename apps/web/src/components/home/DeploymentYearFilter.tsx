"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface DeploymentYearFilterProps {
  range: { start: number; end: number };
  onRangeChange: (range: { start: number; end: number }) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1997; // Argo program started in 1999, but some earlier data exists
const MAX_YEAR = CURRENT_YEAR;

export function DeploymentYearFilter({
  range,
  onRangeChange,
}: DeploymentYearFilterProps) {
  const [localRange, setLocalRange] = useState([range.start, range.end]);
  const [inputStart, setInputStart] = useState(range.start.toString());
  const [inputEnd, setInputEnd] = useState(range.end.toString());

  const handleSliderChange = useCallback(
    (values: number[]) => {
      setLocalRange(values);
      setInputStart(values[0].toString());
      setInputEnd(values[1].toString());
      onRangeChange({ start: values[0], end: values[1] });
    },
    [onRangeChange],
  );

  const handleInputChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setInputStart(value);
    } else {
      setInputEnd(value);
    }
  };

  const handleInputBlur = (type: "start" | "end") => {
    let newStart = range.start;
    let newEnd = range.end;

    if (type === "start") {
      const parsed = parseInt(inputStart, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_YEAR && parsed <= range.end) {
        newStart = parsed;
      } else {
        setInputStart(range.start.toString()); // Reset invalid input
      }
    } else {
      const parsed = parseInt(inputEnd, 10);
      if (
        !Number.isNaN(parsed) &&
        parsed <= MAX_YEAR &&
        parsed >= range.start
      ) {
        newEnd = parsed;
      } else {
        setInputEnd(range.end.toString()); // Reset invalid input
      }
    }

    if (newStart !== range.start || newEnd !== range.end) {
      setLocalRange([newStart, newEnd]);
      onRangeChange({ start: newStart, end: newEnd });
    }
  };

  const handlePresetClick = (preset: { start: number; end: number }) => {
    setLocalRange([preset.start, preset.end]);
    setInputStart(preset.start.toString());
    setInputEnd(preset.end.toString());
    onRangeChange(preset);
  };

  const presets = [
    { label: "All Time", start: MIN_YEAR, end: MAX_YEAR },
    // { label: "Last 5Y", start: MAX_YEAR - 5, end: MAX_YEAR },
    { label: "Last 10Y", start: MAX_YEAR - 10, end: MAX_YEAR },
    { label: "Early Period", start: MIN_YEAR, end: 2010 },
    { label: "Modern Era", start: 2010, end: MAX_YEAR },
  ];

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 space-y-4">
        {/* Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Deployment Year Range</Label>
            <div className="text-sm text-muted-foreground">
              {localRange[0]} - {localRange[1]}
            </div>
          </div>
          <div className="px-2">
            <Slider
              value={localRange}
              onValueChange={handleSliderChange}
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{MIN_YEAR}</span>
            <span>{MAX_YEAR}</span>
          </div>
        </div>

        {/* Manual Input */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start-year" className="text-xs">
              Start Year
            </Label>
            <Input
              id="start-year"
              value={inputStart}
              onChange={(e) => handleInputChange("start", e.target.value)}
              onBlur={() => handleInputBlur("start")}
              className="h-8 text-sm"
              placeholder={MIN_YEAR.toString()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-year" className="text-xs">
              End Year
            </Label>
            <Input
              id="end-year"
              value={inputEnd}
              onChange={(e) => handleInputChange("end", e.target.value)}
              onBlur={() => handleInputBlur("end")}
              className="h-8 text-sm"
              placeholder={MAX_YEAR.toString()}
            />
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Select</Label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className={`h-7 text-xs ${
                  localRange[0] === preset.start && localRange[1] === preset.end
                    ? "bg-primary text-primary-foreground"
                    : ""
                }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded">
          <div className="font-medium mb-1">Deployment Years</div>
          <div>
            Filter floats by their initial deployment year. This affects all
            data visualization and analysis for the selected time range.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
