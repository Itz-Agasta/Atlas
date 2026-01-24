"use client";

import { Navigation, TrendingDown, TrendingUp, Wind } from "lucide-react";
import {
  CartesianGrid,
  Dot,
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

interface DriftData {
  timestamp: string;
  speed: number;
  direction: number;
  latitude: number;
  longitude: number;
  distance: number; // cumulative distance
  displacement: number; // distance from start
}

interface DriftAnalysisChartProps {
  data: DriftData[];
  className?: string;
}

const chartConfig = {
  speed: {
    label: "Speed",
    color: "#2563eb",
  },
  direction: {
    label: "Direction",
    color: "#60a5fa",
  },
  displacement: {
    label: "Displacement",
    color: "#22c55e",
  },
};

// Convert direction to wind rose compass points
const getCompassDirection = (degrees: number) => {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Custom dot component for direction visualization
const DirectionDot = (props: {
  cx?: number;
  cy?: number;
  payload?: { direction?: number };
}) => {
  const { cx, cy, payload } = props;
  if (!(payload?.direction && cx && cy)) return <Dot {...props} />;

  const direction = payload.direction;
  const radians = (direction - 90) * (Math.PI / 180); // Convert to radians, adjust for math coords
  const arrowSize = 8;

  return (
    <g>
      <circle cx={cx} cy={cy} fill="#60a5fa" r="3" />
      <path
        d={`M ${cx} ${cy} L ${cx + arrowSize * Math.cos(radians)} ${cy + arrowSize * Math.sin(radians)}`}
        markerEnd="url(#arrowhead)"
        stroke="#60a5fa"
        strokeWidth="2"
      />
    </g>
  );
};

export default function DriftAnalysisChart({
  data,
  className,
}: DriftAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Drift Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No drift data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const avgSpeed = data.reduce((sum, d) => sum + d.speed, 0) / data.length;
  const maxSpeed = Math.max(...data.map((d) => d.speed));
  const totalDistance = data[data.length - 1]?.distance || 0;
  const totalDisplacement = data[data.length - 1]?.displacement || 0;
  const efficiency =
    totalDistance > 0 ? (totalDisplacement / totalDistance) * 100 : 0;

  // Prepare chart data
  const chartData = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
    speedLabel: `${d.speed.toFixed(2)} km/h`,
    directionLabel: `${d.direction.toFixed(0)}° (${getCompassDirection(d.direction)})`,
    distanceLabel: `${d.distance.toFixed(1)} km`,
    displacementLabel: `${d.displacement.toFixed(1)} km`,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Drift Analysis
          </CardTitle>
          <Badge className="font-mono" variant="outline">
            {data.length} points
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Avg Speed</div>
            <div className="flex items-center gap-1 font-semibold text-lg">
              {avgSpeed.toFixed(2)} km/h
              <Navigation className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Max Speed</div>
            <div className="flex items-center gap-1 font-semibold text-lg">
              {maxSpeed.toFixed(2)} km/h
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Distance</div>
            <div className="font-semibold text-lg">
              {totalDistance.toFixed(1)} km
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Efficiency</div>
            <div className="flex items-center gap-1 font-semibold text-lg">
              {efficiency.toFixed(1)}%
              {efficiency > 70 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-orange-500" />
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Side-by-side Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Speed Chart */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Speed Profile</h4>
            <ChartContainer className="h-[280px]" config={chartConfig}>
              <LineChart data={chartData}>
                <defs>
                  <marker
                    id="arrowhead"
                    markerHeight="7"
                    markerWidth="10"
                    orient="auto"
                    refX="10"
                    refY="3.5"
                  >
                    <polygon fill="#60a5fa" points="0 0, 10 3.5, 0 7" />
                  </marker>
                </defs>
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
                    value: "Speed (km/h)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  tickLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => [
                        name === "speed" ? props.payload?.speedLabel : value,
                        chartConfig[name as keyof typeof chartConfig]?.label ||
                          name,
                      ]}
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
                  label={{ value: "Avg", position: "top" }}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  y={avgSpeed}
                />
                <Line
                  activeDot={{ r: 5 }}
                  dataKey="speed"
                  dot={{ r: 3 }}
                  stroke="var(--color-speed)"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ChartContainer>
          </div>

          {/* Direction & Displacement Chart */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Direction & Displacement</h4>
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
                  domain={[0, 360]}
                  fontSize={11}
                  label={{
                    value: "Direction (°)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  orientation="left"
                  tickLine={false}
                  yAxisId="direction"
                />
                <YAxis
                  axisLine={false}
                  fontSize={11}
                  label={{
                    value: "Displacement (km)",
                    angle: 90,
                    position: "insideRight",
                  }}
                  orientation="right"
                  tickLine={false}
                  yAxisId="displacement"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => {
                        if (name === "direction") {
                          return [props.payload?.directionLabel, "Direction"];
                        }
                        if (name === "displacement") {
                          return [
                            props.payload?.displacementLabel,
                            "Displacement",
                          ];
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
                <Line
                  activeDot={{ r: 5 }}
                  dataKey="direction"
                  dot={<DirectionDot />}
                  stroke="var(--color-direction)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="direction"
                />
                <Line
                  activeDot={{ r: 4 }}
                  dataKey="displacement"
                  dot={{ r: 2 }}
                  stroke="var(--color-displacement)"
                  strokeWidth={2}
                  type="monotone"
                  yAxisId="displacement"
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
