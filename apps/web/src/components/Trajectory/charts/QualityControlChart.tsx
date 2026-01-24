"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Eye,
  Filter,
  Shield,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
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
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { Separator } from "@/components/ui/separator";

interface QualityData {
  parameter: "temperature" | "salinity" | "pressure" | "oxygen" | "chlorophyll";
  timestamp: string;
  depth: number;
  value: number;
  qualityFlag: number;
  qcTest: string;
  confidence: number; // 0-100
  outlierScore?: number;
  profileId: string;
}

interface QualityControlChartProps {
  data: QualityData[];
  className?: string;
}

const chartConfig = {
  good: {
    label: "Good",
    color: "hsl(var(--chart-1))",
  },
  probablyGood: {
    label: "Probably Good",
    color: "hsl(var(--chart-2))",
  },
  questionable: {
    label: "Questionable",
    color: "hsl(var(--chart-3))",
  },
  bad: {
    label: "Bad",
    color: "hsl(var(--chart-4))",
  },
  missing: {
    label: "Missing",
    color: "hsl(var(--chart-5))",
  },
};

const getQualityInfo = (flag: number) => {
  const qualityMap = {
    1: {
      label: "Good",
      category: "good",
      icon: CheckCircle,
      color: "text-green-600",
    },
    2: {
      label: "Probably Good",
      category: "probablyGood",
      icon: CheckCircle,
      color: "text-green-500",
    },
    3: {
      label: "Questionable",
      category: "questionable",
      icon: AlertTriangle,
      color: "text-yellow-600",
    },
    4: { label: "Bad", category: "bad", icon: X, color: "text-red-600" },
    5: {
      label: "Changed",
      category: "questionable",
      icon: Activity,
      color: "text-orange-600",
    },
    6: {
      label: "Not Used",
      category: "missing",
      icon: Filter,
      color: "text-gray-600",
    },
    8: {
      label: "Estimated",
      category: "questionable",
      icon: Eye,
      color: "text-blue-600",
    },
    9: {
      label: "Missing",
      category: "missing",
      icon: X,
      color: "text-gray-600",
    },
  };

  return qualityMap[flag as keyof typeof qualityMap] || qualityMap[4];
};

const QUALITY_COLORS = {
  good: "#22c55e",
  probablyGood: "#84cc16",
  questionable: "#eab308",
  bad: "#ef4444",
  missing: "#6b7280",
};

export default function QualityControlChart({
  data,
  className,
}: QualityControlChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Quality Control Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No quality control data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall statistics
  const totalMeasurements = data.length;
  const qualityStats = data.reduce(
    (acc, d) => {
      const info = getQualityInfo(d.qualityFlag);
      acc[info.category] = (acc[info.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const goodDataPercentage =
    (((qualityStats.good || 0) + (qualityStats.probablyGood || 0)) /
      totalMeasurements) *
    100;
  const avgConfidence =
    data.reduce((sum, d) => sum + d.confidence, 0) / data.length;

  // Parameter-wise quality distribution
  const parameterStats = data.reduce(
    (acc, d) => {
      if (!acc[d.parameter]) {
        acc[d.parameter] = {
          total: 0,
          good: 0,
          bad: 0,
          questionable: 0,
          missing: 0,
        };
      }
      acc[d.parameter].total++;
      const info = getQualityInfo(d.qualityFlag);
      if (info.category === "good" || info.category === "probablyGood") {
        acc[d.parameter].good++;
      } else if (info.category === "bad") {
        acc[d.parameter].bad++;
      } else if (info.category === "questionable") {
        acc[d.parameter].questionable++;
      } else {
        acc[d.parameter].missing++;
      }
      return acc;
    },
    {} as Record<
      string,
      {
        total: number;
        good: number;
        bad: number;
        questionable: number;
        missing: number;
      }
    >
  );

  // QC test performance
  const qcTestStats = data.reduce(
    (acc, d) => {
      if (!acc[d.qcTest]) {
        acc[d.qcTest] = { passed: 0, failed: 0, total: 0 };
      }
      acc[d.qcTest].total++;
      if (d.qualityFlag <= 2) {
        acc[d.qcTest].passed++;
      } else {
        acc[d.qcTest].failed++;
      }
      return acc;
    },
    {} as Record<string, { passed: number; failed: number; total: number }>
  );

  // Prepare radar chart data - showing quality metrics across different dimensions
  const radarData = [
    {
      metric: "Good Quality",
      value: ((qualityStats.good || 0) / totalMeasurements) * 100,
      maxValue: 100,
    },
    {
      metric: "Probably Good",
      value: ((qualityStats.probablyGood || 0) / totalMeasurements) * 100,
      maxValue: 100,
    },
    {
      metric: "Confidence",
      value: avgConfidence,
      maxValue: 100,
    },
    {
      metric: "Parameters",
      value: (Object.keys(parameterStats).length / 5) * 100, // Normalize to 5 max parameters
      maxValue: 100,
    },
    {
      metric: "QC Tests",
      value: (Object.keys(qcTestStats).length / 10) * 100, // Normalize to 10 max tests
      maxValue: 100,
    },
  ];

  const parameterChartData = Object.entries(parameterStats).map(
    ([param, stats]) => ({
      parameter: param.charAt(0).toUpperCase() + param.slice(1),
      goodPercentage: (stats.good / stats.total) * 100,
      questionablePercentage: (stats.questionable / stats.total) * 100,
      badPercentage: (stats.bad / stats.total) * 100,
      missingPercentage: (stats.missing / stats.total) * 100,
      total: stats.total,
    })
  );

  const qcTestChartData = Object.entries(qcTestStats).map(([test, stats]) => ({
    test: test.replace(/([A-Z])/g, " $1").trim(),
    passRate: (stats.passed / stats.total) * 100,
    failRate: (stats.failed / stats.total) * 100,
    total: stats.total,
  }));

  // Confidence trend over time
  const confidenceData = data
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .map((d, index) => ({
      index: index + 1,
      confidence: d.confidence,
      timestamp: new Date(d.timestamp).toLocaleDateString(),
      qualityFlag: d.qualityFlag,
      parameter: d.parameter,
    }));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Quality Control Metrics
          </CardTitle>
          <Badge className="font-mono" variant="outline">
            {totalMeasurements} measurements
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Data Quality</div>
            <div className="flex items-center gap-1 font-semibold text-lg">
              {goodDataPercentage.toFixed(1)}%
              {goodDataPercentage >= 95 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : goodDataPercentage >= 85 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Avg Confidence</div>
            <div className="font-semibold text-lg">
              {avgConfidence.toFixed(1)}%
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">QC Tests</div>
            <div className="font-semibold text-lg">
              {Object.keys(qcTestStats).length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Parameters</div>
            <div className="font-semibold text-lg">
              {Object.keys(parameterStats).length}
            </div>
          </div>
        </div>

        {/* Overall Data Quality Progress */}
        <ProgressIndicator
          title="Overall Data Quality"
          value={goodDataPercentage}
        />

        <Separator />

        {/* Quality Control Metrics - 2x2 Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Row */}
          {/* Quality Flag Distribution */}
          <Card className="p-6">
            <div className="space-y-4">
              <h4 className="flex items-center justify-center gap-2 font-semibold text-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Quality Metrics Overview
              </h4>
              <ChartContainer
                className="mx-auto flex h-[350px] w-full max-w-[350px] items-center justify-center"
                config={chartConfig}
              >
                <RadarChart
                  data={radarData}
                  height={350}
                  margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                  width={350}
                >
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${(value as number).toFixed(1)}%`,
                          "Score",
                        ]}
                      />
                    }
                    cursor={false}
                  />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <PolarGrid />
                  <Radar
                    dataKey="value"
                    dot={{
                      r: 5,
                      fill: "#15803d",
                      strokeWidth: 2,
                      stroke: "#ffffff",
                    }}
                    fill="#22c55e"
                    fillOpacity={0.4}
                    stroke="#16a34a"
                    strokeWidth={3}
                  />
                </RadarChart>
              </ChartContainer>
            </div>
          </Card>

          {/* Quality by Parameter */}
          <Card className="p-6">
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-semibold text-lg">
                <Activity className="h-5 w-5 text-blue-500" />
                Quality by Parameter
              </h4>

              {/* Alternative approach: Custom stacked bars with guaranteed colors */}
              <div className="h-[280px] space-y-4 overflow-y-auto">
                {parameterChartData.map((param) => (
                  <div className="space-y-3" key={param.parameter}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {param.parameter}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {param.total} measurements
                      </span>
                    </div>

                    {/* Visual stacked bar */}
                    <div className="relative h-8 overflow-hidden rounded-lg border bg-muted">
                      <div
                        className="absolute top-0 left-0 h-full transition-all duration-300"
                        style={{
                          width: `${param.goodPercentage}%`,
                          backgroundColor: QUALITY_COLORS.good,
                        }}
                        title={`Good: ${param.goodPercentage.toFixed(1)}%`}
                      />
                      <div
                        className="absolute top-0 h-full transition-all duration-300"
                        style={{
                          left: `${param.goodPercentage}%`,
                          width: `${param.questionablePercentage}%`,
                          backgroundColor: QUALITY_COLORS.questionable,
                        }}
                        title={`Questionable: ${param.questionablePercentage.toFixed(1)}%`}
                      />
                      <div
                        className="absolute top-0 h-full transition-all duration-300"
                        style={{
                          left: `${param.goodPercentage + param.questionablePercentage}%`,
                          width: `${param.badPercentage}%`,
                          backgroundColor: QUALITY_COLORS.bad,
                        }}
                        title={`Bad: ${param.badPercentage.toFixed(1)}%`}
                      />
                      <div
                        className="absolute top-0 h-full transition-all duration-300"
                        style={{
                          left: `${param.goodPercentage + param.questionablePercentage + param.badPercentage}%`,
                          width: `${param.missingPercentage}%`,
                          backgroundColor: QUALITY_COLORS.missing,
                        }}
                        title={`Missing: ${param.missingPercentage.toFixed(1)}%`}
                      />
                    </div>

                    {/* Percentage labels */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: QUALITY_COLORS.good }}
                          />
                          <span className="font-medium text-xs">
                            {param.goodPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: QUALITY_COLORS.questionable,
                            }}
                          />
                          <span className="font-medium text-xs">
                            {param.questionablePercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: QUALITY_COLORS.bad }}
                          />
                          <span className="font-medium text-xs">
                            {param.badPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: QUALITY_COLORS.missing }}
                          />
                          <span className="font-medium text-xs">
                            {param.missingPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simplified Legend */}
              <div className="border-t pt-2">
                <h5 className="mb-2 text-center font-medium text-sm">
                  Quality Categories
                </h5>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "#22c55e" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Good Quality
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "#eab308" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Questionable
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "#ef4444" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Bad Quality
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "#6b7280" }}
                    />
                    <span className="text-muted-foreground text-xs">
                      Missing Data
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* QC Test Performance */}
          <Card className="p-6">
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-semibold text-lg">
                <Shield className="h-5 w-5 text-purple-500" />
                QC Test Performance
              </h4>
              <ChartContainer className="h-[280px]" config={chartConfig}>
                <BarChart data={qcTestChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    angle={-45}
                    axisLine={false}
                    dataKey="test"
                    fontSize={11}
                    height={80}
                    textAnchor="end"
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    domain={[0, 100]}
                    fontSize={12}
                    label={{
                      value: "Pass Rate (%)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    tickLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(_value, name, props) => [
                          `${(props.payload?.passRate || 0).toFixed(1)}%`,
                          name === "passRate" ? "Pass Rate" : "Fail Rate",
                        ]}
                        labelFormatter={(label, payload) => {
                          if (payload?.[0]?.payload) {
                            return `${label} (${payload[0].payload.total} tests)`;
                          }
                          return label;
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="passRate"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </Card>

          {/* Confidence Trend */}
          <Card className="p-6">
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-semibold text-lg">
                <Eye className="h-5 w-5 text-cyan-500" />
                Confidence Trend
              </h4>
              <ChartContainer className="h-[280px]" config={chartConfig}>
                <ComposedChart data={confidenceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="index"
                    fontSize={12}
                    label={{ value: "Measurement #", position: "bottom" }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    domain={[0, 100]}
                    fontSize={12}
                    label={{
                      value: "Confidence (%)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    tickLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(_value, _name, props) => [
                          `${props.payload?.confidence.toFixed(1)}%`,
                          "Confidence",
                        ]}
                        labelFormatter={(label, payload) => {
                          if (payload?.[0]?.payload) {
                            return `${payload[0].payload.parameter} - ${payload[0].payload.timestamp}`;
                          }
                          return label;
                        }}
                      />
                    }
                  />
                  <Area
                    dataKey="confidence"
                    fill="#0891b2"
                    fillOpacity={0.3}
                    stroke="#0891b2"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Line
                    activeDot={{ r: 4 }}
                    dataKey="confidence"
                    dot={{ r: 2 }}
                    stroke="#0891b2"
                    strokeWidth={2}
                    type="monotone"
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
