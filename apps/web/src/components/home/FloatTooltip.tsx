"use client";

import { CalendarIcon, MapPinIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TooltipData } from "@/types/argo";

interface FloatTooltipProps {
  data: TooltipData | null;
  position: { x: number; y: number } | null;
  visible: boolean;
}

export default function FloatTooltip({
  data,
  position,
  visible,
}: FloatTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (visible && data && position) {
      // Small delay for smooth transition
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [visible, data, position]);

  if (!data || !position || !visible) {
    return null;
  }

  // Format the date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Calculate tooltip position to avoid going off screen
  const getTooltipStyle = () => {
    const tooltipWidth = 260;
    const tooltipHeight = 110;
    const padding = 12;

    let left = position.x + 15;
    let top = position.y - tooltipHeight / 2;

    // Check if tooltip goes off the right edge
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = position.x - tooltipWidth - 15;
    }

    // Check if tooltip goes off the top edge
    if (top < padding) {
      top = padding;
    }

    // Check if tooltip goes off the bottom edge
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "scale(1)" : "scale(0.95)",
    };
  };

  return (
    <div
      className="fixed z-50 pointer-events-none transition-all duration-200 ease-out"
      style={getTooltipStyle()}
    >
      <Card className="shadow-lg border backdrop-blur-sm bg-background/95">
        <CardContent className="p-3 space-y-2">
          {/* Header with ID */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium">
              ID: {data.id}
            </Badge>
          </div>

          {/* Information Grid */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPinIcon className="h-3 w-3" />
                <span>Position</span>
              </div>
              <span className="font-mono text-foreground">
                {data.longitude.toFixed(1)}°, {data.latitude.toFixed(1)}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                <span>Date</span>
              </div>
              <span className="text-foreground">{formatDate(data.date)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RotateCcwIcon className="h-3 w-3" />
                <span>Cycle</span>
              </div>
              <span className="text-foreground">{data.cycle}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
