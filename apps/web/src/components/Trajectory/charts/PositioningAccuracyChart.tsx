"use client";

import { AlertTriangle, CheckCircle, Satellite, Target } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
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

type PositioningData = {
  timestamp: string;
  latitude: number;
  longitude: number;
  horizontalAccuracy: number; // meters
  verticalAccuracy?: number; // meters
  satelliteCount: number;
  hdop: number; // Horizontal Dilution of Precision
  fixType: "GPS" | "DGPS" | "RTK" | "Estimated";
  signalStrength: number; // dB
};

type PositioningAccuracyChartProps = {
  data: PositioningData[];
  className?: string;
};

const chartConfig = {
  horizontalAccuracy: {
    label: "Horizontal Accuracy",
    color: "#2563eb",
  },
  verticalAccuracy: {
    label: "Vertical Accuracy",
    color: "#60a5fa",
  },
  satelliteCount: {
    label: "Satellites",
    color: "#22c55e",
  },
  hdop: {
    label: "HDOP",
    color: "#f59e0b",
  },
  signalStrength: {
    label: "Signal Strength",
    color: "#ef4444",
  },
};

const getFixTypeColor = (fixType: string) => {
  switch (fixType) {
    case "RTK":
      return "text-green-600";
    case "DGPS":
      return "text-blue-600";
    case "GPS":
      return "text-yellow-600";
    case "Estimated":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

const getFixTypeIcon = (fixType: string) => {
  switch (fixType) {
    case "RTK":
    case "DGPS":
      return <CheckCircle className="h-4 w-4" />;
    case "GPS":
      return <Target className="h-4 w-4" />;
    case "Estimated":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Satellite className="h-4 w-4" />;
  }
};

export default function PositioningAccuracyChart({
  data,
  className,
}: PositioningAccuracyChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Satellite className="h-5 w-5" />
            Positioning Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No positioning data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const avgAccuracy =
    data.reduce((sum, d) => sum + d.horizontalAccuracy, 0) / data.length;
  const bestAccuracy = Math.min(...data.map((d) => d.horizontalAccuracy));
  const worstAccuracy = Math.max(...data.map((d) => d.horizontalAccuracy));
  const avgSatellites =
    data.reduce((sum, d) => sum + d.satelliteCount, 0) / data.length;

  // Fix type distribution
  const fixTypeStats = data.reduce(
    (acc, d) => {
      acc[d.fixType] = (acc[d.fixType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Prepare chart data
  const chartData = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
    accuracyLabel: `${d.horizontalAccuracy.toFixed(1)} m`,
    satelliteLabel: `${d.satelliteCount} satellites`,
    hdopLabel: `HDOP: ${d.hdop.toFixed(2)}`,
    signalLabel: `${d.signalStrength.toFixed(1)} dB`,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Satellite className="h-5 w-5" />
            Positioning Accuracy
          </CardTitle>
          <Badge className="font-mono" variant="outline">
            {data.length} fixes
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Avg Accuracy</div>
            <div className="font-semibold text-lg">
              {avgAccuracy.toFixed(1)} m
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Best Accuracy</div>
            <div className="font-semibold text-green-600 text-lg">
              {bestAccuracy.toFixed(1)} m
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Worst Accuracy</div>
            <div className="font-semibold text-lg text-orange-600">
              {worstAccuracy.toFixed(1)} m
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Avg Satellites</div>
            <div className="font-semibold text-lg">
              {avgSatellites.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Fix Type Distribution */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Fix Type Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fixTypeStats).map(([type, count]) => (
              <Badge
                className={`${getFixTypeColor(type)} flex items-center gap-1`}
                key={type}
                variant="outline"
              >
                {getFixTypeIcon(type)}
                {type}: {count}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Side-by-side Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Accuracy Over Time */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Horizontal Accuracy Profile</h4>
            <ChartContainer className="h-[280px]" config={chartConfig}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  angle={-45}
                  axisLine={false}
                  dataKey="time"
                  fontSize={11}
                  height={60}
                  textAnchor="end"
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  fontSize={11}
                  label={{
                    value: "Accuracy (m)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  tickLine={false}
                  yAxisId="accuracy"
                />
                <YAxis
                  axisLine={false}
                  fontSize={11}
                  label={{
                    value: "Satellites",
                    angle: 90,
                    position: "insideRight",
                  }}
                  orientation="right"
                  tickLine={false}
                  yAxisId="satellites"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => {
                        if (name === "horizontalAccuracy") {
                          return [props.payload?.accuracyLabel, "Accuracy"];
                        }
                        if (name === "satelliteCount") {
                          return [props.payload?.satelliteLabel, "Satellites"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload) {
                          const p = payload[0].payload;
                          return `${p.time} - ${p.fixType}`;
                        }
                        return label;
                      }}
                    />
                  }
                />
                <ReferenceLine
                  label={{ value: "Avg", position: "top" }}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  y={avgAccuracy}
                  yAxisId="accuracy"
                />
                <Area
                  dataKey="horizontalAccuracy"
                  fill="var(--color-horizontalAccuracy)"
                  fillOpacity={0.2}
                  stroke="var(--color-horizontalAccuracy)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="accuracy"
                />
                <Line
                  activeDot={{ r: 4 }}
                  dataKey="satelliteCount"
                  dot={{ r: 2 }}
                  stroke="var(--color-satelliteCount)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="satellites"
                />
              </ComposedChart>
            </ChartContainer>
          </div>

          {/* HDOP and Signal Strength */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Signal Quality Metrics</h4>
            <ChartContainer className="h-[280px]" config={chartConfig}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  angle={-45}
                  axisLine={false}
                  dataKey="time"
                  fontSize={11}
                  height={60}
                  textAnchor="end"
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  fontSize={11}
                  label={{ value: "HDOP", angle: -90, position: "insideLeft" }}
                  tickLine={false}
                  yAxisId="hdop"
                />
                <YAxis
                  axisLine={false}
                  fontSize={11}
                  label={{
                    value: "Signal (dB)",
                    angle: 90,
                    position: "insideRight",
                  }}
                  orientation="right"
                  tickLine={false}
                  yAxisId="signal"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => {
                        if (name === "hdop") {
                          return [props.payload?.hdopLabel, "HDOP"];
                        }
                        if (name === "signalStrength") {
                          return [props.payload?.signalLabel, "Signal"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload) {
                          return `Date: ${payload[0].payload.time}`;
                        }
                        return label;
                      }}
                    />
                  }
                />
                <ReferenceLine
                  label={{ value: "Poor", position: "top" }}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  y={2}
                  yAxisId="hdop"
                />
                <ReferenceLine
                  label={{ value: "Good", position: "top" }}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 5"
                  y={1}
                  yAxisId="hdop"
                />
                <Line
                  activeDot={{ r: 4 }}
                  dataKey="hdop"
                  dot={{ r: 2 }}
                  stroke="var(--color-hdop)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="hdop"
                />
                <Line
                  activeDot={{ r: 4 }}
                  dataKey="signalStrength"
                  dot={{ r: 2 }}
                  stroke="var(--color-signalStrength)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="signal"
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
