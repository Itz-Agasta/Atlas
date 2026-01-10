"use client";

import { ArrowDown, ArrowUp, Clock, Target, Waves } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";

interface CyclePhase {
  phase: "surface" | "descent" | "drift" | "ascent" | "surface_transmission";
  startTime: string;
  endTime: string;
  duration: number; // in hours
  cycleNumber: number;
  depth?: number;
  temperature?: number;
  notes?: string;
}

interface CyclePhaseDurationChartProps {
  data: CyclePhase[];
  className?: string;
}

const chartConfig = {
  surface: {
    label: "Surface",
    color: "#2563eb",
  },
  descent: {
    label: "Descent",
    color: "#60a5fa",
  },
  drift: {
    label: "Drift",
    color: "#22c55e",
  },
  ascent: {
    label: "Ascent",
    color: "#f59e0b",
  },
  surface_transmission: {
    label: "Surface Transmission",
    color: "#ef4444",
  },
};

const getPhaseIcon = (phase: string) => {
  switch (phase) {
    case "surface":
      return <Waves className="h-4 w-4" />;
    case "descent":
      return <ArrowDown className="h-4 w-4" />;
    case "drift":
      return <Target className="h-4 w-4" />;
    case "ascent":
      return <ArrowUp className="h-4 w-4" />;
    case "surface_transmission":
      return <Waves className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getPhaseColor = (phase: string) => {
  const colors = {
    surface: "text-blue-600",
    descent: "text-red-600",
    drift: "text-green-600",
    ascent: "text-orange-600",
    surface_transmission: "text-purple-600",
  };
  return colors[phase as keyof typeof colors] || "text-gray-600";
};

export default function CyclePhaseDurationChart({
  data,
  className,
}: CyclePhaseDurationChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cycle Phase Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No cycle data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const phaseStats = data.reduce(
    (acc, phase) => {
      if (!acc[phase.phase]) {
        acc[phase.phase] = { total: 0, count: 0, avg: 0 };
      }
      acc[phase.phase].total += phase.duration;
      acc[phase.phase].count += 1;
      acc[phase.phase].avg = acc[phase.phase].total / acc[phase.phase].count;
      return acc;
    },
    {} as Record<string, { total: number; count: number; avg: number }>,
  );

  // Group by cycle for timeline view
  const cycleData = data.reduce(
    (acc, phase) => {
      if (!acc[phase.cycleNumber]) {
        acc[phase.cycleNumber] = [];
      }
      acc[phase.cycleNumber].push(phase);
      return acc;
    },
    {} as Record<number, CyclePhase[]>,
  );

  // Prepare chart data for phase duration trends
  const trendData = Object.entries(cycleData)
    .map(([cycleNum, phases]) => {
      const cycle = Number.parseInt(cycleNum);
      const phaseMap = phases.reduce(
        (acc, phase) => {
          acc[phase.phase] = phase.duration;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        cycle,
        ...phaseMap,
        totalDuration: phases.reduce((sum, p) => sum + p.duration, 0),
        cycleLabel: `Cycle ${cycle}`,
        phases: phases.length,
      };
    })
    .sort((a, b) => a.cycle - b.cycle);

  // Prepare data for phase distribution
  const phaseDistribution = Object.entries(phaseStats).map(
    ([phase, stats]) => ({
      phase,
      avgDuration: stats.avg,
      count: stats.count,
      totalDuration: stats.total,
      label: chartConfig[phase as keyof typeof chartConfig]?.label || phase,
    }),
  );

  const totalCycles = Object.keys(cycleData).length;
  const avgCycleDuration =
    trendData.length > 0
      ? trendData.reduce((sum, c) => sum + c.totalDuration, 0) /
        trendData.length
      : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cycle Phase Duration
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {totalCycles} cycles
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Cycles</div>
            <div className="text-lg font-semibold">{totalCycles}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">
              Avg Cycle Duration
            </div>
            <div className="text-lg font-semibold">
              {avgCycleDuration.toFixed(1)} h
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Phases</div>
            <div className="text-lg font-semibold">{data.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Longest Phase</div>
            <div className="text-lg font-semibold">
              {Math.max(...data.map((d) => d.duration)).toFixed(1)} h
            </div>
          </div>
        </div>

        {/* Phase Distribution */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Phase Distribution</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {phaseDistribution.map((phase) => (
              <Badge
                key={phase.phase}
                variant="outline"
                className={`${getPhaseColor(phase.phase)} flex items-center gap-1 justify-center p-2`}
              >
                {getPhaseIcon(phase.phase)}
                <div className="text-center">
                  <div className="text-xs font-medium">{phase.label}</div>
                  <div className="text-xs">
                    {phase.avgDuration.toFixed(1)}h avg
                  </div>
                </div>
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Side-by-side Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Average Phase Duration */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Average Phase Duration</h4>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <BarChart data={phaseDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Duration (hours)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(_value, _name, props) => [
                        `${props.payload?.avgDuration.toFixed(1)} hours`,
                        "Average Duration",
                      ]}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload) {
                          return `${label} (${payload[0].payload.count} occurrences)`;
                        }
                        return label;
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="avgDuration"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Cycle Duration Trends */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Cycle Duration Trends</h4>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="cycleLabel"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Duration (hours)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const label =
                          chartConfig[name as keyof typeof chartConfig]
                            ?.label || name;
                        return [`${(value as number).toFixed(1)} hours`, label];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload) {
                          return `${label} (${payload[0].payload.phases} phases)`;
                        }
                        return label;
                      }}
                    />
                  }
                />
                <ReferenceLine
                  y={avgCycleDuration}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{ value: "Avg", position: "top" }}
                />

                {/* Stacked areas for each phase */}
                <Area
                  type="monotone"
                  dataKey="surface"
                  stackId="1"
                  stroke="var(--color-surface)"
                  fill="var(--color-surface)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="descent"
                  stackId="1"
                  stroke="var(--color-descent)"
                  fill="var(--color-descent)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="drift"
                  stackId="1"
                  stroke="var(--color-drift)"
                  fill="var(--color-drift)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="ascent"
                  stackId="1"
                  stroke="var(--color-ascent)"
                  fill="var(--color-ascent)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="surface_transmission"
                  stackId="1"
                  stroke="var(--color-surface_transmission)"
                  fill="var(--color-surface_transmission)"
                  fillOpacity={0.6}
                />

                {/* Total duration line */}
                <Line
                  type="monotone"
                  dataKey="totalDuration"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        </div>

        {/* Recent Cycle Details */}
        {trendData.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Latest Cycle Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(
                  cycleData[Math.max(...Object.keys(cycleData).map(Number))] ||
                    {},
                ).map(([_index, phase]) => (
                  <div
                    key={`${phase.cycleNumber}-${phase.phase}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className={getPhaseColor(phase.phase)}>
                        {getPhaseIcon(phase.phase)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {chartConfig[phase.phase as keyof typeof chartConfig]
                            ?.label || phase.phase}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(phase.startTime).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {phase.duration.toFixed(1)} h
                      </div>
                      {phase.depth && (
                        <div className="text-xs text-muted-foreground">
                          {phase.depth.toFixed(0)} m depth
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
