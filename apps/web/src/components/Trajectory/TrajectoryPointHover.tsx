"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TrajectoryPoint } from "@/data/mockTrajectoryData";

interface TrajectoryPointHoverProps {
  point: TrajectoryPoint;
  pointNumber: number;
  isStart?: boolean;
  isEnd?: boolean;
}

export default function TrajectoryPointHover({
  point,
  pointNumber,
  isStart = false,
  isEnd = false,
}: TrajectoryPointHoverProps) {
  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatCoordinate = (value: number, type: "lat" | "lng") => {
    const direction =
      type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
    return `${Math.abs(value).toFixed(4)}°${direction}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500 text-white";
      case "current":
        return "bg-blue-500 text-white";
      case "completed":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  const getPointTypeInfo = () => {
    if (isStart)
      return { label: "Start Point", color: "bg-green-100 text-green-800" };
    if (isEnd) return { label: "End Point", color: "bg-red-100 text-red-800" };
    return {
      label: `Point ${pointNumber}`,
      color: "bg-blue-100 text-blue-800",
    };
  };

  const pointTypeInfo = getPointTypeInfo();

  return (
    <div className="min-w-[280px] space-y-2 rounded-lg border bg-white p-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge className={pointTypeInfo.color} variant="outline">
          {pointTypeInfo.label}
        </Badge>
        <Badge className={getStatusColor(point.status)}>
          {point.status.toUpperCase()}
        </Badge>
      </div>

      <Separator />

      {/* Location Information */}
      <div className="space-y-1">
        <h4 className="font-semibold text-gray-900 text-sm">Location</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium text-gray-600">Latitude:</span>
            <div className="text-gray-900">
              {formatCoordinate(point.latitude, "lat")}
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-600">Longitude:</span>
            <div className="text-gray-900">
              {formatCoordinate(point.longitude, "lng")}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Timestamp */}
      <div className="space-y-1">
        <h4 className="font-semibold text-gray-900 text-sm">Time</h4>
        <div className="text-gray-900 text-xs">
          {formatDate(point.timestamp)}
        </div>
      </div>

      {/* Oceanographic Data (if available) */}
      {(point.depth !== undefined ||
        point.temperature !== undefined ||
        point.salinity !== undefined) && (
        <>
          <Separator />
          <div className="space-y-1">
            <h4 className="font-semibold text-gray-900 text-sm">
              Measurements
            </h4>
            <div className="grid gap-1 text-xs">
              {point.depth !== undefined && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Depth:</span>
                  <span className="text-gray-900">
                    {point.depth.toFixed(1)} m
                  </span>
                </div>
              )}
              {point.temperature !== undefined && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    Temperature:
                  </span>
                  <span className="text-gray-900">
                    {point.temperature.toFixed(2)}°C
                  </span>
                </div>
              )}
              {point.salinity !== undefined && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Salinity:</span>
                  <span className="text-gray-900">
                    {point.salinity.toFixed(3)} PSU
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Special indicators for start/end points */}
      {(isStart || isEnd) && (
        <>
          <Separator />
          <div className="text-center text-gray-500 text-xs">
            {isStart && "🚀 Mission Start"}
            {isEnd && "🏁 Mission End"}
          </div>
        </>
      )}
    </div>
  );
}
