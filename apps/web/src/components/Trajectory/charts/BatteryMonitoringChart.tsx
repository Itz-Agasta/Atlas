"use client";

import {
  AlertTriangle,
  Battery,
  BatteryLow,
  BatteryWarning,
  CheckCircle,
  Clock,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { Separator } from "@/components/ui/separator";

interface BatteryData {
  timestamp: string;
  voltage: number;
  current?: number; // mA
  powerConsumption?: number; // W
  temperature: number;
  cycleNumber: number;
  phase: "surface" | "descent" | "drift" | "ascent" | "transmission";
  estimatedRemaining?: number; // percentage
}

interface BatteryMonitoringChartProps {
  data: BatteryData[];
  className?: string;
  specifications?: {
    nominalVoltage: number;
    lowVoltageThreshold: number;
    criticalVoltageThreshold: number;
    capacity: number; // Ah
    expectedLifetime: number; // days
  };
}

const chartConfig = {
  voltage: {
    label: "Voltage",
    color: "#ff6b35",
  },
  current: {
    label: "Current",
    color: "#60a5fa",
  },
  powerConsumption: {
    label: "Power",
    color: "#22c55e",
  },
  temperature: {
    label: "Temperature",
    color: "#f59e0b",
  },
  estimatedRemaining: {
    label: "Remaining",
    color: "#ef4444",
  },
};

const getBatteryIcon = (
  voltage: number,
  specs?: BatteryMonitoringChartProps["specifications"],
) => {
  if (!specs) return <Battery className="h-5 w-5" />;

  if (voltage <= specs.criticalVoltageThreshold) {
    return <BatteryLow className="h-5 w-5 text-red-500" />;
  }
  if (voltage <= specs.lowVoltageThreshold) {
    return <BatteryWarning className="h-5 w-5 text-yellow-500" />;
  }
  return <Battery className="h-5 w-5 text-green-500" />;
};

const getBatteryStatus = (
  voltage: number,
  specs?: BatteryMonitoringChartProps["specifications"],
) => {
  if (!specs) return { status: "Unknown", color: "text-gray-600" };

  if (voltage <= specs.criticalVoltageThreshold) {
    return { status: "Critical", color: "text-red-600" };
  }
  if (voltage <= specs.lowVoltageThreshold) {
    return { status: "Low", color: "text-yellow-600" };
  }
  return { status: "Good", color: "text-green-600" };
};

export default function BatteryMonitoringChart({
  data,
  className,
  specifications,
}: BatteryMonitoringChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            Battery Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No battery data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort data by timestamp
  const sortedData = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const latestData = sortedData[sortedData.length - 1];
  const firstData = sortedData[0];

  // Calculate statistics
  const currentVoltage = latestData.voltage;
  const initialVoltage = firstData.voltage;
  const voltageDecline = initialVoltage - currentVoltage;
  const avgPowerConsumption =
    data
      .filter((d) => d.powerConsumption)
      .reduce((sum, d) => sum + (d.powerConsumption || 0), 0) /
    data.filter((d) => d.powerConsumption).length;

  // Battery health estimation
  const batteryHealth = specifications
    ? Math.max(
        0,
        Math.min(
          100,
          ((currentVoltage - specifications.criticalVoltageThreshold) /
            (specifications.nominalVoltage -
              specifications.criticalVoltageThreshold)) *
            100,
        ),
      )
    : undefined;

  // Estimated lifetime remaining
  const daysRunning =
    (new Date(latestData.timestamp).getTime() -
      new Date(firstData.timestamp).getTime()) /
    (1000 * 60 * 60 * 24);
  const estimatedRemainingDays =
    specifications && voltageDecline > 0
      ? ((currentVoltage - specifications.criticalVoltageThreshold) /
          voltageDecline) *
        daysRunning
      : undefined;

  // Prepare chart data
  const chartData = sortedData.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
    voltageLabel: `${d.voltage.toFixed(2)}V`,
    currentLabel: d.current ? `${d.current.toFixed(1)} mA` : "N/A",
    powerLabel: d.powerConsumption
      ? `${d.powerConsumption.toFixed(3)} W`
      : "N/A",
    tempLabel: `${d.temperature.toFixed(1)}°C`,
    remainingLabel: d.estimatedRemaining
      ? `${d.estimatedRemaining.toFixed(1)}%`
      : "N/A",
  }));

  const batteryStatus = getBatteryStatus(currentVoltage, specifications);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getBatteryIcon(currentVoltage, specifications)}
            Battery Monitoring
          </CardTitle>
          <Badge
            variant="outline"
            className={`font-mono ${batteryStatus.color}`}
          >
            {batteryStatus.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Critical Alerts */}
        {specifications && (
          <>
            {currentVoltage <= specifications.criticalVoltageThreshold && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Critical Battery Level:</strong> Voltage has dropped
                  to {currentVoltage.toFixed(2)}V. Immediate attention required.
                </AlertDescription>
              </Alert>
            )}
            {currentVoltage <= specifications.lowVoltageThreshold &&
              currentVoltage > specifications.criticalVoltageThreshold && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <BatteryWarning className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Low Battery Warning:</strong> Voltage is{" "}
                    {currentVoltage.toFixed(2)}V. Monitor closely for declining
                    performance.
                  </AlertDescription>
                </Alert>
              )}
          </>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Current Voltage</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              {currentVoltage.toFixed(2)}V
              {voltageDecline > 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Voltage Decline</div>
            <div className="text-lg font-semibold">
              {voltageDecline.toFixed(3)}V
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Avg Power</div>
            <div className="text-lg font-semibold">
              {avgPowerConsumption
                ? `${avgPowerConsumption.toFixed(3)}W`
                : "N/A"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Days Running</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              {daysRunning.toFixed(0)}
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Battery Health */}
        {batteryHealth !== undefined && (
          <ProgressIndicator title="Battery Health" value={batteryHealth} />
        )}

        {/* Estimated Remaining Time */}
        {estimatedRemainingDays !== undefined && (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">
              Estimated Remaining
            </div>
            <div className="text-lg font-semibold">
              {estimatedRemainingDays > 0
                ? `${estimatedRemainingDays.toFixed(0)} days`
                : "Calculate pending"}
            </div>
          </div>
        )}

        <Separator />

        {/* Side-by-side Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Voltage Trend */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Voltage Trend</h4>
            <ChartContainer config={chartConfig} className="h-[280px]">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Voltage (V)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  domain={["dataMin - 0.1", "dataMax + 0.1"]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(_value, _name, props) => [
                        props.payload?.voltageLabel,
                        "Voltage",
                      ]}
                      labelFormatter={(label, payload) => {
                        if (payload?.[0]?.payload) {
                          return `${label} - Cycle ${payload[0].payload.cycleNumber}`;
                        }
                        return label;
                      }}
                    />
                  }
                />

                {/* Reference lines for thresholds */}
                {specifications && (
                  <>
                    <ReferenceLine
                      y={specifications.nominalVoltage}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="5 5"
                      label={{ value: "Nominal", position: "top" }}
                    />
                    <ReferenceLine
                      y={specifications.lowVoltageThreshold}
                      stroke="hsl(var(--warning))"
                      strokeDasharray="5 5"
                      label={{ value: "Low", position: "top" }}
                    />
                    <ReferenceLine
                      y={specifications.criticalVoltageThreshold}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="5 5"
                      label={{ value: "Critical", position: "top" }}
                    />
                  </>
                )}

                <Area
                  type="monotone"
                  dataKey="voltage"
                  stroke="var(--color-voltage)"
                  fill="var(--color-voltage)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="voltage"
                  stroke="var(--color-voltage)"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>

          {/* Power Consumption by Phase */}
          {chartData.some((d) => d.powerConsumption) ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">
                Power Consumption by Phase
              </h4>
              <ChartContainer config={chartConfig} className="h-[280px]">
                <ComposedChart
                  data={chartData.filter((d) => d.powerConsumption)}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    yAxisId="power"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "Power (W)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <YAxis
                    yAxisId="temp"
                    orientation="right"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: "Temperature (°C)",
                      angle: 90,
                      position: "insideRight",
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => {
                          if (name === "powerConsumption") {
                            return [props.payload?.powerLabel, "Power"];
                          }
                          if (name === "temperature") {
                            return [props.payload?.tempLabel, "Temperature"];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload?.[0]?.payload) {
                            return `${label} - ${payload[0].payload.phase}`;
                          }
                          return label;
                        }}
                      />
                    }
                  />
                  <Bar
                    yAxisId="power"
                    dataKey="powerConsumption"
                    fill="var(--color-powerConsumption)"
                    opacity={0.7}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temperature"
                    stroke="var(--color-temperature)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">
                Power Consumption by Phase
              </h4>
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No power consumption data available
              </div>
            </div>
          )}
        </div>

        {/* Specifications */}
        {specifications && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Battery Specifications</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Nominal Voltage:</div>
                  <div className="font-medium">
                    {specifications.nominalVoltage}V
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Capacity:</div>
                  <div className="font-medium">{specifications.capacity}Ah</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Low Threshold:</div>
                  <div className="font-medium text-yellow-600">
                    {specifications.lowVoltageThreshold}V
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    Critical Threshold:
                  </div>
                  <div className="font-medium text-red-600">
                    {specifications.criticalVoltageThreshold}V
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
