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
    <div className="w-full bg-background px-6 py-8 overflow-y-auto h-full">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              Float {metadata.id}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs px-2 py-1">
                Cycle {metadata.cycleNumber}
              </Badge>
            </div>
          </div>
          <p className="text-base font-medium text-foreground leading-relaxed">
            {metadata.name}
          </p>
        </div>

        <Separator />

        {/* Time Period Selector */}
        <TimePeriodSelector />

        {/* Float Details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <FaChartLine className="h-5 w-5 text-primary" />
              Float Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Country
              </span>
              <p className="text-base font-semibold text-foreground">
                {metadata.country}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Institution
              </span>
              <p className="text-base text-foreground leading-relaxed">
                {metadata.institution}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      metadata.status === "Active" ? "default" : "secondary"
                    }
                    className={
                      metadata.status === "Active"
                        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800 px-3 py-1"
                        : "px-3 py-1"
                    }
                  >
                    {metadata.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Data Center
                </span>
                <p className="text-base font-medium text-foreground">
                  {metadata.dataCenter}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cycle Information */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <FaCompass className="h-5 w-5 text-primary" />
              Cycle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Cycle Number
                </span>
                <p className="text-2xl font-bold text-primary">
                  {metadata.cycleNumber}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Direction
                </span>
                <Badge variant="outline" className="w-fit px-3 py-1 text-sm">
                  {metadata.direction}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FaCalendarAlt className="h-4 w-4" />
                Date & Time
              </span>
              <p className="text-base font-mono text-foreground bg-muted/50 px-4 py-3 rounded-md">
                {metadata.datetime}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Data Levels
                </span>
                <p className="text-lg font-semibold text-foreground">
                  {metadata.numberOfLevels}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Data Mode
                </span>
                <Badge variant="outline" className="w-fit px-3 py-1 text-sm">
                  {metadata.dataMode}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Position */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <FaMapMarkerAlt className="h-5 w-5 text-primary" />
              Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-base font-mono text-center text-foreground">
                  {Math.abs(metadata.position.latitude).toFixed(4)}°
                  {metadata.position.latitude >= 0 ? "N" : "S"}{" "}
                  {Math.abs(metadata.position.longitude).toFixed(4)}°
                  {metadata.position.longitude >= 0 ? "E" : "W"}
                </p>
              </div>
            </div>

            {/* Mini Map */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Location Preview
              </span>
              <MiniMap
                latitude={metadata.position.latitude}
                longitude={metadata.position.longitude}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Quality */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <FaDatabase className="h-5 w-5 text-primary" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Overall Quality
              </span>
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800 px-3 py-1 text-sm"
              >
                Good (Level {metadata.quality})
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md leading-relaxed">
              Data has passed quality control checks and is suitable for
              scientific analysis.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
