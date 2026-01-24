"use client";

import {
  FaCalendarAlt,
  FaChartLine,
  FaCompass,
  FaDatabase,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { MiniMap } from "@/components/profile/MiniMap";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { FloatMetadata } from "@/data/mockOceanographicData";

interface FloatSidebarProps {
  metadata: FloatMetadata;
}

export function FloatSidebar({ metadata }: FloatSidebarProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-background px-6 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="font-bold text-2xl text-foreground leading-tight">
              Float {metadata.id}
            </h1>
            <div className="flex items-center gap-2">
              <Badge className="px-2 py-1 text-xs" variant="secondary">
                Cycle {metadata.cycleNumber}
              </Badge>
            </div>
          </div>
          <p className="font-medium text-base text-foreground leading-relaxed">
            {metadata.name}
          </p>
        </div>

        <Separator />

        {/* Time Period Selector */}
        <TimePeriodSelector />

        {/* Float Details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <FaChartLine className="h-5 w-5 text-primary" />
              Float Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Country
              </span>
              <p className="font-semibold text-base text-foreground">
                {metadata.country}
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Institution
              </span>
              <p className="text-base text-foreground leading-relaxed">
                {metadata.institution}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Status
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      metadata.status === "Active"
                        ? "border-green-200 bg-green-100 px-3 py-1 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-100"
                        : "px-3 py-1"
                    }
                    variant={
                      metadata.status === "Active" ? "default" : "secondary"
                    }
                  >
                    {metadata.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Data Center
                </span>
                <p className="font-medium text-base text-foreground">
                  {metadata.dataCenter}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cycle Information */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <FaCompass className="h-5 w-5 text-primary" />
              Cycle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Cycle Number
                </span>
                <p className="font-bold text-2xl text-primary">
                  {metadata.cycleNumber}
                </p>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Direction
                </span>
                <Badge className="w-fit px-3 py-1 text-sm" variant="outline">
                  {metadata.direction}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <span className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                <FaCalendarAlt className="h-4 w-4" />
                Date & Time
              </span>
              <p className="rounded-md bg-muted/50 px-4 py-3 font-mono text-base text-foreground">
                {metadata.datetime}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Data Levels
                </span>
                <p className="font-semibold text-foreground text-lg">
                  {metadata.numberOfLevels}
                </p>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                  Data Mode
                </span>
                <Badge className="w-fit px-3 py-1 text-sm" variant="outline">
                  {metadata.dataMode}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Position */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <FaMapMarkerAlt className="h-5 w-5 text-primary" />
              Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-center font-mono text-base text-foreground">
                  {Math.abs(metadata.position.latitude).toFixed(4)}°
                  {metadata.position.latitude >= 0 ? "N" : "S"}{" "}
                  {Math.abs(metadata.position.longitude).toFixed(4)}°
                  {metadata.position.longitude >= 0 ? "E" : "W"}
                </p>
              </div>
            </div>

            {/* Mini Map */}
            <div className="space-y-3">
              <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Location Preview
              </span>
              <MiniMap
                className="w-full"
                latitude={metadata.position.latitude}
                longitude={metadata.position.longitude}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Quality */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <FaDatabase className="h-5 w-5 text-primary" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Overall Quality
              </span>
              <Badge
                className="border-green-200 bg-green-100 px-3 py-1 text-green-800 text-sm dark:border-green-800 dark:bg-green-900 dark:text-green-100"
                variant="default"
              >
                Good (Level {metadata.quality})
              </Badge>
            </div>
            <div className="rounded-md bg-muted/50 p-4 text-muted-foreground text-sm leading-relaxed">
              Data has passed quality control checks and is suitable for
              scientific analysis.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
