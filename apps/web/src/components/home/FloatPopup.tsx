"use client";

import { CalendarIcon, MapPinIcon, User2Icon, WifiIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PopupData } from "@/types/argo";

interface InlineFloatPopupProps {
  data: PopupData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onShowProfile?: () => void;
  visible: boolean;
}

export default function FloatPopup({
  data,
  position,
  onClose,
  onShowProfile,
  visible,
}: InlineFloatPopupProps) {
  const router = useRouter();

  if (!data || !position || !visible) {
    return null;
  }

  // Format the date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleActionClick = (action: string) => {
    if (action === "Profile" && onShowProfile) {
      onShowProfile();
    } else if (action === "Trajectory") {
      router.push(`/trajectory/${data.floatNumber}`);
    } else {
      console.log(`Action clicked: ${action} for float ${data.floatNumber}`);
      alert(`${action} for Float ${data.floatNumber} - Feature coming soon!`);
    }
  };

  // Calculate position to keep popup on screen
  const getPopupStyle = () => {
    const popupWidth = 320;
    const popupHeight = 280;
    const padding = 16;

    let left = position.x + 10;
    let top = position.y - popupHeight / 2;

    // Adjust if popup goes off right edge
    if (left + popupWidth > window.innerWidth - padding) {
      left = position.x - popupWidth - 10;
    }

    // Adjust if popup goes off top edge
    if (top < padding) {
      top = padding;
    }

    // Adjust if popup goes off bottom edge
    if (top + popupHeight > window.innerHeight - padding) {
      top = window.innerHeight - popupHeight - padding;
    }

    return {
      left: `${Math.max(padding, left)}px`,
      top: `${Math.max(padding, top)}px`,
      width: `${popupWidth}px`,
    };
  };

  return (
    <Card
      className="fixed z-50 shadow-lg border animate-in fade-in zoom-in duration-200"
      style={getPopupStyle()}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base leading-none">
              Float {data.floatNumber}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cycle {data.cycle}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date and Platform Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(data.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPinIcon className="h-4 w-4 text-muted-foreground" />
            <span>{data.platformType}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User2Icon className="h-4 w-4 text-muted-foreground" />
            <span>{data.pi}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <WifiIcon className="h-4 w-4 text-muted-foreground" />
            <span>{data.telecomCode}</span>
          </div>
        </div>

        <Separator />

        {/* Sensors */}
        <div>
          <p className="text-sm font-medium mb-2">Sensors</p>
          <div className="flex flex-wrap gap-1">
            {data.sensors.map((sensor) => (
              <Badge key={sensor} variant="secondary" className="text-xs">
                {sensor}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleActionClick("Profile")}
            className="flex-1"
            size="sm"
          >
            Profile
          </Button>
          <Button
            onClick={() => handleActionClick("Trajectory")}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            Trajectory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
