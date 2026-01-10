"use client";

import {
  Activity,
  BarChart3,
  Calendar,
  Database,
  Info,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateMockBatteryData,
  generateMockCyclePhases,
  generateMockDriftData,
  generateMockPositioningData,
  generateMockProfileData,
  generateMockQualityData,
} from "@/data/mockEnhancedTrajectoryData";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";
import BatteryMonitoringChart from "./charts/BatteryMonitoringChart";
import CyclePhaseDurationChart from "./charts/CyclePhaseDurationChart";
import DriftAnalysisChart from "./charts/DriftAnalysisChart";
import MultiParameterProfileChart from "./charts/MultiParameterProfileChart";
import PositioningAccuracyChart from "./charts/PositioningAccuracyChart";
import ProfileOverlayChart from "./charts/ProfileOverlayChart";
import QualityControlChart from "./charts/QualityControlChart";
import TemperatureSalinityChart from "./charts/TemperatureSalinityChart";
import TrajectoryTimelineChart from "./charts/TrajectoryTimelineChart";

interface TrajectoryDashboardProps {
  trajectory: FloatTrajectory;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "inactive":
      return "bg-gray-500";
    case "completed":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const getQualityFlagDescription = (flag: number) => {
  const descriptions = {
    1: "Good",
    2: "Probably good",
    3: "Probably bad",
    4: "Bad",
    5: "Changed",
    6: "Not used",
    7: "Not used",
    8: "Estimated",
    9: "Missing",
  };
  return descriptions[flag as keyof typeof descriptions] || "Unknown";
};

const getQualityFlagColor = (flag: number) => {
  if (flag <= 2) return "bg-green-500";
  if (flag <= 3) return "bg-yellow-500";
  if (flag <= 4) return "bg-red-500";
  return "bg-gray-500";
};

export default function TrajectoryDashboard({
  trajectory,
}: TrajectoryDashboardProps) {
  // Generate mock enhanced data for demonstration
  const driftData = React.useMemo(
    () => generateMockDriftData(trajectory.points),
    [trajectory.points],
  );

  const positioningData = React.useMemo(
    () => generateMockPositioningData(trajectory.points),
    [trajectory.points],
  );

  const profileData = React.useMemo(() => generateMockProfileData(), []);

  const cyclePhases = React.useMemo(() => generateMockCyclePhases(), []);

  const batteryData = React.useMemo(
    () => generateMockBatteryData(trajectory.points),
    [trajectory.points],
  );

  const qualityData = React.useMemo(() => generateMockQualityData(), []);

  const batterySpecs = {
    nominalVoltage: 15.0,
    lowVoltageThreshold: 14.0,
    criticalVoltageThreshold: 13.0,
    capacity: 50,
    expectedLifetime: 365,
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Float Trajectory</h1>
          <p className="text-muted-foreground mt-1">
            Tracking path for {trajectory.floatNumber}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={`${getStatusColor(trajectory.status)} text-white`}
        >
          {trajectory.status.toUpperCase()}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Distance
            </CardTitle>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trajectory.totalDistance} km
            </div>
            <p className="text-xs text-muted-foreground">
              Over {trajectory.missionDuration} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trajectory.points.length}</div>
            <p className="text-xs text-muted-foreground">
              Measurement locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mission Duration
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trajectory.missionDuration}
            </div>
            <p className="text-xs text-muted-foreground">Days active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Type</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trajectory.platformType}</div>
            <p className="text-xs text-muted-foreground">Float model</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Tabbed Dashboard Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-1 text-xs"
          >
            <Info className="h-3 w-3" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="flex items-center gap-1 text-xs"
          >
            <BarChart3 className="h-3 w-3" />
            Analysis
          </TabsTrigger>
          <TabsTrigger
            value="monitoring"
            className="flex items-center gap-1 text-xs"
          >
            <Activity className="h-3 w-3" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger
            value="profiles"
            className="flex items-center gap-1 text-xs"
          >
            <Database className="h-3 w-3" />
            Profiles
          </TabsTrigger>
          <TabsTrigger
            value="quality"
            className="flex items-center gap-1 text-xs"
          >
            <Route className="h-3 w-3" />
            Quality
          </TabsTrigger>
          <TabsTrigger
            value="metadata"
            className="flex items-center gap-1 text-xs"
          >
            <Calendar className="h-3 w-3" />
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* About Float */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About Float</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">WMO</span>
                  <span className="font-mono">{trajectory.wmo}</span>

                  <span className="font-medium text-muted-foreground">
                    Platform maker
                  </span>
                  <span>{trajectory.platformMaker}</span>

                  <span className="font-medium text-muted-foreground">
                    Float serial number
                  </span>
                  <span className="font-mono">{trajectory.floatSerial}</span>

                  <span className="font-medium text-muted-foreground">
                    Platform type
                  </span>
                  <span>{trajectory.platformType}</span>

                  <span className="font-medium text-muted-foreground">
                    Transmission system
                  </span>
                  <span>{trajectory.transmissionSystem}</span>

                  <span className="font-medium text-muted-foreground">PTT</span>
                  <span className="font-mono">{trajectory.ptt}</span>

                  <span className="font-medium text-muted-foreground">
                    Owner
                  </span>
                  <span className="text-xs">{trajectory.owner}</span>

                  <span className="font-medium text-muted-foreground">
                    Data Centre
                  </span>
                  <span>{trajectory.dataCentre}</span>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Sensors
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {trajectory.sensors.map((sensor) => (
                      <Badge key={sensor} variant="outline" className="text-xs">
                        {sensor}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deployment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deployment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Launched
                  </span>
                  <p className="text-sm">
                    {Math.round(
                      (Date.now() -
                        new Date(trajectory.deploymentDate).getTime()) /
                        (1000 * 60 * 60 * 24 * 30),
                    )}{" "}
                    months ago
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatDate(trajectory.deploymentDate)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Deployment Latitude
                  </span>
                  <span className="font-mono">
                    {trajectory.deploymentLatitude}°
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Deployment Longitude
                  </span>
                  <span className="font-mono">
                    {trajectory.deploymentLongitude}°
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Ship
                  </span>
                  <span className="text-xs">{trajectory.ship}</span>

                  <span className="font-medium text-muted-foreground">
                    Cruise
                  </span>
                  <span className="font-mono text-xs">{trajectory.cruise}</span>

                  <span className="font-medium text-muted-foreground">
                    Project
                  </span>
                  <span className="text-xs">{trajectory.project}</span>

                  <span className="font-medium text-muted-foreground">
                    Principal Investigator
                  </span>
                  <span className="text-xs">
                    {trajectory.principalInvestigator}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Cycle Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cycle Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Status
                  </span>
                  <Badge
                    variant={
                      trajectory.status === "active" ? "default" : "secondary"
                    }
                  >
                    {trajectory.status}
                  </Badge>

                  <span className="font-medium text-muted-foreground">Age</span>
                  <span>{trajectory.age} years old</span>

                  <span className="font-medium text-muted-foreground">
                    Last profile date
                  </span>
                  <span className="font-mono text-xs">
                    {formatDateTime(trajectory.lastProfileDate)}
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Cycle
                  </span>
                  <span className="font-mono">{trajectory.cycle}</span>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Last Surface Data
                  </span>
                  <p className="text-xs font-mono">
                    {trajectory.lastSurfaceData.pressure} dbar{" "}
                    {trajectory.lastSurfaceData.temperature.toFixed(3)}℃{" "}
                    {trajectory.lastSurfaceData.salinity.toFixed(2)} PSU
                  </p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Last Bottom Data
                  </span>
                  <p className="text-xs font-mono">
                    {trajectory.lastBottomData.pressure} dbar{" "}
                    {trajectory.lastBottomData.temperature.toFixed(3)}℃{" "}
                    {trajectory.lastBottomData.salinity.toFixed(2)} PSU
                  </p>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Profiles data
                  </span>
                  <div className="flex gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                    >
                      in Ascii
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                    >
                      in Netcdf
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analysis Tab - Enhanced Charts */}
        <TabsContent value="analysis" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 gap-6">
            <DriftAnalysisChart data={driftData} />
            <PositioningAccuracyChart data={positioningData} />
            <CyclePhaseDurationChart data={cyclePhases} />
          </div>
        </TabsContent>

        {/* Monitoring Tab - System Health */}
        <TabsContent value="monitoring" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 gap-6">
            <BatteryMonitoringChart
              data={batteryData}
              specifications={batterySpecs}
            />
          </div>
        </TabsContent>

        {/* Profiles Tab - Oceanographic Data */}
        <TabsContent value="profiles" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 gap-6">
            <MultiParameterProfileChart data={profileData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Temperature-Salinity Diagram</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Interactive scatter plot showing the relationship between
                    temperature and salinity, colored by depth
                  </p>
                </CardHeader>
                <CardContent>
                  <TemperatureSalinityChart trajectory={trajectory} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Temperature Profiles</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Overlaid temperature vs depth profiles showing changes over
                    time
                  </p>
                </CardHeader>
                <CardContent>
                  <ProfileOverlayChart trajectory={trajectory} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Quality Tab - QC Metrics */}
        <TabsContent value="quality" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 gap-6">
            <QualityControlChart data={qualityData} />
          </div>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Control */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Control</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Data quality flags and validation status
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Data Mode
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {trajectory.qualityControl.dataMode}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {trajectory.qualityControl.dataMode === "A"
                        ? "Automatic"
                        : trajectory.qualityControl.dataMode === "R"
                          ? "Real-time"
                          : "Delayed mode"}
                    </span>
                  </div>

                  <span className="font-medium text-muted-foreground">
                    Position QC
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${getQualityFlagColor(trajectory.qualityControl.positionQC)} text-white text-xs`}
                    >
                      {trajectory.qualityControl.positionQC}
                    </Badge>
                    <span className="text-xs">
                      {getQualityFlagDescription(
                        trajectory.qualityControl.positionQC,
                      )}
                    </span>
                  </div>

                  <span className="font-medium text-muted-foreground">
                    Temperature QC
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${getQualityFlagColor(trajectory.qualityControl.temperatureQC)} text-white text-xs`}
                    >
                      {trajectory.qualityControl.temperatureQC}
                    </Badge>
                    <span className="text-xs">
                      {getQualityFlagDescription(
                        trajectory.qualityControl.temperatureQC,
                      )}
                    </span>
                  </div>

                  <span className="font-medium text-muted-foreground">
                    Salinity QC
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${getQualityFlagColor(trajectory.qualityControl.salinityQC)} text-white text-xs`}
                    >
                      {trajectory.qualityControl.salinityQC}
                    </Badge>
                    <span className="text-xs">
                      {getQualityFlagDescription(
                        trajectory.qualityControl.salinityQC,
                      )}
                    </span>
                  </div>

                  <span className="font-medium text-muted-foreground">
                    Pressure QC
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${getQualityFlagColor(trajectory.qualityControl.pressureQC)} text-white text-xs`}
                    >
                      {trajectory.qualityControl.pressureQC}
                    </Badge>
                    <span className="text-xs">
                      {getQualityFlagDescription(
                        trajectory.qualityControl.pressureQC,
                      )}
                    </span>
                  </div>

                  <span className="font-medium text-muted-foreground">
                    Last QC Date
                  </span>
                  <span className="text-xs font-mono">
                    {formatDateTime(trajectory.qualityControl.lastQCDate)}
                  </span>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    QC Tests Performed
                  </span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trajectory.qualityControl.qcPerformed.map((test) => (
                      <Badge key={test} variant="outline" className="text-xs">
                        {test}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Processing */}
            <Card>
              <CardHeader>
                <CardTitle>Data Processing</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Processing level and calibration information
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <span className="font-medium text-muted-foreground">
                    Processing Level
                  </span>
                  <Badge variant="secondary" className="text-xs w-fit">
                    {trajectory.dataProcessing.processingLevel}
                  </Badge>

                  <span className="font-medium text-muted-foreground">
                    Software Version
                  </span>
                  <span className="font-mono text-xs">
                    {trajectory.dataProcessing.softwareVersion}
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Calibration Date
                  </span>
                  <span className="text-xs font-mono">
                    {formatDate(trajectory.dataProcessing.calibrationDate)}
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Vertical Sampling
                  </span>
                  <span className="text-xs">
                    {trajectory.dataProcessing.verticalSampling}
                  </span>

                  <span className="font-medium text-muted-foreground">
                    Data Recovery
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">
                      {trajectory.dataProcessing.dataRecovery}%
                    </span>
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{
                          width: `${trajectory.dataProcessing.dataRecovery}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-muted-foreground text-sm">
                    Processing History
                  </span>
                  <div className="mt-2 space-y-1">
                    {trajectory.dataProcessing.processingHistory.map((step) => (
                      <div key={step} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trajectory Data Tab */}
        <TabsContent value="trajectory" className="space-y-6 mt-6">
          {/* Recent Measurements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Measurements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trajectory.points
                  .slice(-5)
                  .reverse()
                  .map((point) => (
                    <div
                      key={point.id}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Point #{point.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(point.timestamp)}
                          </p>
                          <p className="text-sm">
                            {point.latitude.toFixed(4)}°N,{" "}
                            {point.longitude.toFixed(4)}°E
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p>Depth: {point.depth?.toFixed(1)}m</p>
                          <p>Temp: {point.temperature?.toFixed(1)}°C</p>
                          <p>Salinity: {point.salinity?.toFixed(2)} PSU</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Data Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Trajectory Timeline</CardTitle>
              <p className="text-sm text-muted-foreground">
                Interactive timeline showing depth changes over time, colored by
                temperature
              </p>
            </CardHeader>
            <CardContent>
              <TrajectoryTimelineChart trajectory={trajectory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
