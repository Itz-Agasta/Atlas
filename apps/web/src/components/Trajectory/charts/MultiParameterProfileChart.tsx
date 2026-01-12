"use client";

import * as d3 from "d3";
import { Activity, Droplets, Gauge, Layers, Thermometer } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileData {
  depth: number;
  temperature: number;
  salinity: number;
  pressure: number;
  oxygen?: number;
  chlorophyll?: number;
  density: number;
  qualityFlag: number;
  timestamp: string;
}

interface MultiParameterProfileChartProps {
  data: ProfileData[];
  className?: string;
  title?: string;
}

// D3.js Profile Chart Component
interface D3ProfileChartProps {
  data: ProfileData[];
  parameters: Array<{
    key: keyof ProfileData;
    name: string;
    color: string;
    unit: string;
  }>;
  width?: number;
  height?: number;
  title: string;
}

function D3ProfileChart({
  data,
  parameters,
  width = 600,
  height = 500,
  title,
}: D3ProfileChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length || !parameters.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 140, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Depth scale (y-axis)
    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.depth) as [number, number])
      .range([0, innerHeight]);

    // Normalize scales for each parameter (0 to 1)
    const normalizedScales = parameters
      .map((param) => {
        const values = data
          .map((d) => d[param.key] as number)
          .filter((v) => v !== undefined && v !== null && !Number.isNaN(v));

        if (values.length === 0) return null;

        const extent = d3.extent(values) as [number, number];
        return {
          ...param,
          scale: d3.scaleLinear().domain(extent).range([0, 1]),
          originalExtent: extent,
        };
      })
      .filter(Boolean);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    // Add gradients for each parameter
    normalizedScales.forEach((param, i) => {
      if (!param) return;

      const gradient = svg
        .append("defs")
        .append("linearGradient")
        .attr("id", `gradient-${i}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight);

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", param.color)
        .attr("stop-opacity", 0.6);

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", param.color)
        .attr("stop-opacity", 0.1);
    });

    // Add depth axis
    const yAxis = d3
      .axisLeft(yScale)
      .tickFormat((d) => `${d}m`)
      .ticks(8);

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#374151");

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .style("stroke-dasharray", "2,2")
      .style("opacity", 0.3)
      .style("stroke", "#9ca3af");

    g.selectAll(".domain, .tick line")
      .style("stroke", "#9ca3af")
      .style("stroke-width", 1);

    // Create lines and areas for each parameter
    normalizedScales.forEach((param, paramIndex) => {
      if (!param) return;

      const validData = data.filter((d) => {
        const value = d[param.key] as number;
        return value !== undefined && value !== null && !Number.isNaN(value);
      });

      if (validData.length === 0) return;

      const paramLine = d3
        .line<ProfileData>()
        .x((d) => xScale(param.scale(d[param.key] as number)))
        .y((d) => yScale(d.depth))
        .curve(d3.curveMonotoneY);

      const paramArea = d3
        .area<ProfileData>()
        .x((d) => xScale(param.scale(d[param.key] as number)))
        .y0(xScale(0))
        .y1((d) => yScale(d.depth))
        .curve(d3.curveMonotoneY);

      // Add area fill
      g.append("path")
        .datum(validData)
        .attr("class", `profile-area-${paramIndex}`)
        .attr("d", paramArea)
        .style("fill", `url(#gradient-${paramIndex})`)
        .style("opacity", 0.4);

      // Add the line
      const path = g
        .append("path")
        .datum(validData)
        .attr("class", `profile-line-${paramIndex}`)
        .attr("d", paramLine)
        .style("fill", "none")
        .style("stroke", param.color)
        .style("stroke-width", 2.5)
        .style("stroke-linejoin", "round")
        .style("stroke-linecap", "round")
        .style("opacity", 0.9);

      // Add data points with quality indicators
      g.selectAll(`.data-point-${paramIndex}`)
        .data(validData.filter((_, i) => i % 6 === 0)) // Show fewer points to avoid clutter
        .enter()
        .append("circle")
        .attr("class", `data-point-${paramIndex}`)
        .attr("cx", (d) => xScale(param.scale(d[param.key] as number)))
        .attr("cy", (d) => yScale(d.depth))
        .attr("r", (d) => {
          const data = d as ProfileData;
          if (data.qualityFlag <= 2) return 3;
          if (data.qualityFlag <= 3) return 4;
          return 5;
        })
        .style("fill", param.color)
        .style("stroke", "white")
        .style("stroke-width", 1.5)
        .style("opacity", (d) => {
          const data = d as ProfileData;
          if (data.qualityFlag <= 2) return 0.8;
          if (data.qualityFlag <= 3) return 0.6;
          return 0.4;
        });

      // Animation
      const totalLength = path.node()?.getTotalLength() || 0;
      path
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2500)
        .delay(paramIndex * 400)
        .ease(d3.easeCircleOut)
        .attr("stroke-dashoffset", 0);

      // Animate data points
      g.selectAll(`.data-point-${paramIndex}`)
        .style("opacity", 0)
        .transition()
        .duration(800)
        .delay(paramIndex * 400 + 1000)
        .ease(d3.easeBackOut.overshoot(0.3))
        .style("opacity", (d) => {
          const data = d as ProfileData;
          if (data.qualityFlag <= 2) return 0.8;
          if (data.qualityFlag <= 3) return 0.6;
          return 0.4;
        });
    });

    // Add tooltips
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("z-index", "1000")
      .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.15)")
      .style("border", "1px solid rgba(255, 255, 255, 0.1)");

    // Add interaction area for all points
    g.selectAll('[class*="data-point-"]')
      .on("mouseover", function (_, d) {
        const data = d as ProfileData;
        const parameterInfo = normalizedScales
          .map((param) => {
            if (!param) return null;
            const value = data[param.key] as number;
            if (value === undefined || value === null || Number.isNaN(value))
              return null;
            return `<span style="color: ${param.color};">${param.name}: ${value.toFixed(2)} ${param.unit}</span>`;
          })
          .filter(Boolean)
          .join("<br/>");

        const qualityText =
          data.qualityFlag <= 2
            ? '<span style="color: #22c55e;">Good</span>'
            : data.qualityFlag <= 3
              ? '<span style="color: #f59e0b;">Questionable</span>'
              : '<span style="color: #ef4444;">Poor</span>';

        tooltip
          .style("visibility", "visible")
          .html(
            `<strong>Depth: ${data.depth}m</strong><br/>${parameterInfo}<br/>Quality: ${qualityText}`,
          );

        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", function () {
            const currentR = parseFloat(d3.select(this).attr("r"));
            return currentR + 2;
          })
          .style("opacity", 1)
          .style("stroke-width", 2);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function (_, d) {
        tooltip.style("visibility", "hidden");
        const data = d as ProfileData;
        const originalR =
          data.qualityFlag <= 2 ? 3 : data.qualityFlag <= 3 ? 4 : 5;
        const originalOpacity =
          data.qualityFlag <= 2 ? 0.8 : data.qualityFlag <= 3 ? 0.6 : 0.4;

        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", originalR)
          .style("opacity", originalOpacity)
          .style("stroke-width", 1.5);
      });

    // Add title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#1f2937")
      .text(title);

    // Add depth label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 20)
      .attr("x", -(height / 2))
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text("Depth (m)");

    // Add normalized scale label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text("Normalized Values (0-1)");

    // Add legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 130}, ${margin.top})`);

    normalizedScales.forEach((param, i) => {
      if (!param) return;

      const legendItem = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 50})`)
        .style("cursor", "pointer");

      // Add background for legend item
      legendItem
        .append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 125)
        .attr("height", 45)
        .attr("rx", 4)
        .style("fill", "rgba(255, 255, 255, 0.8)")
        .style("stroke", param.color)
        .style("stroke-width", 1)
        .style("opacity", 0.3);

      legendItem
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .style("stroke", param.color)
        .style("stroke-width", 3);

      legendItem
        .append("circle")
        .attr("cx", 10)
        .attr("cy", 0)
        .attr("r", 3)
        .style("fill", param.color)
        .style("stroke", "white")
        .style("stroke-width", 1);

      legendItem
        .append("text")
        .attr("x", 25)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#374151")
        .text(param.name);

      // Add range information on a new line
      legendItem
        .append("text")
        .attr("x", 25)
        .attr("y", 14)
        .style("font-size", "9px")
        .style("fill", "#6b7280")
        .text(
          `${param.originalExtent[0].toFixed(1)}-${param.originalExtent[1].toFixed(1)}`,
        );

      // Add unit on another line
      legendItem
        .append("text")
        .attr("x", 25)
        .attr("y", 26)
        .style("font-size", "9px")
        .style("fill", "#6b7280")
        .text(param.unit);

      // Add interactivity to legend
      legendItem
        .on("mouseover", () => {
          // Highlight corresponding lines and points
          g.selectAll(`.profile-line-${i}, .profile-area-${i}`).style(
            "opacity",
            1,
          );
          g.selectAll(`.data-point-${i}`).style("opacity", 1);

          // Dim other lines
          normalizedScales.forEach((_, j) => {
            if (j !== i) {
              g.selectAll(`.profile-line-${j}, .profile-area-${j}`).style(
                "opacity",
                0.2,
              );
              g.selectAll(`.data-point-${j}`).style("opacity", 0.2);
            }
          });
        })
        .on("mouseout", () => {
          // Restore original opacity
          normalizedScales.forEach((param, j) => {
            if (!param) return;
            g.selectAll(`.profile-line-${j}`).style("opacity", 0.9);
            g.selectAll(`.profile-area-${j}`).style("opacity", 0.4);
            g.selectAll(`.data-point-${j}`).style("opacity", (d) => {
              const data = d as ProfileData;
              if (data.qualityFlag <= 2) return 0.8;
              if (data.qualityFlag <= 3) return 0.6;
              return 0.4;
            });
          });
        });
    });

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".d3-tooltip").remove();
    };
  }, [data, parameters, width, height, title]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
      />
    </div>
  );
}

export default function MultiParameterProfileChart({
  data,
  className,
  title = "Multi-Parameter Profile",
}: MultiParameterProfileChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No profile data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort data by depth
  const sortedData = [...data].sort((a, b) => a.depth - b.depth);

  // Calculate statistics
  const maxDepth = Math.max(...sortedData.map((d) => d.depth));
  const tempRange = {
    min: Math.min(...sortedData.map((d) => d.temperature)),
    max: Math.max(...sortedData.map((d) => d.temperature)),
  };
  const salRange = {
    min: Math.min(...sortedData.map((d) => d.salinity)),
    max: Math.max(...sortedData.map((d) => d.salinity)),
  };

  // Quality statistics
  const qualityStats = sortedData.reduce(
    (acc, d) => {
      if (d.qualityFlag <= 2) acc.good++;
      else if (d.qualityFlag <= 3) acc.questionable++;
      else acc.bad++;
      return acc;
    },
    { good: 0, questionable: 0, bad: 0 },
  );

  // Define parameter configurations
  const tempSalParameters = [
    {
      key: "temperature" as keyof ProfileData,
      name: "Temperature",
      color: "#2563eb",
      unit: "°C",
    },
    {
      key: "salinity" as keyof ProfileData,
      name: "Salinity",
      color: "#60a5fa",
      unit: "PSU",
    },
  ];

  const oxygenParameters = [
    {
      key: "oxygen" as keyof ProfileData,
      name: "Dissolved Oxygen",
      color: "#22c55e",
      unit: "mg/L",
    },
  ];

  const bioParameters = [
    {
      key: "chlorophyll" as keyof ProfileData,
      name: "Chlorophyll",
      color: "#f59e0b",
      unit: "μg/L",
    },
  ];

  const densityParameters = [
    {
      key: "density" as keyof ProfileData,
      name: "Density",
      color: "#ef4444",
      unit: "kg/m³",
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {sortedData.length} measurements
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Max Depth</div>
            <div className="text-lg font-semibold">{maxDepth.toFixed(1)} m</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Temp Range</div>
            <div className="text-lg font-semibold">
              {tempRange.min.toFixed(1)} - {tempRange.max.toFixed(1)}°C
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Sal Range</div>
            <div className="text-lg font-semibold">
              {salRange.min.toFixed(1)} - {salRange.max.toFixed(1)} PSU
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Data Quality</div>
            <div className="text-lg font-semibold text-green-600">
              {((qualityStats.good / sortedData.length) * 100).toFixed(0)}% Good
            </div>
          </div>
        </div>

        {/* Quality Distribution */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Data Quality Distribution</h4>
          <div className="flex gap-3">
            <Badge
              variant="outline"
              className="text-green-600 border-green-200"
            >
              Good: {qualityStats.good}
            </Badge>
            <Badge
              variant="outline"
              className="text-yellow-600 border-yellow-200"
            >
              Questionable: {qualityStats.questionable}
            </Badge>
            <Badge variant="outline" className="text-red-600 border-red-200">
              Bad: {qualityStats.bad}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Tabbed D3.js Charts */}
        <Tabs defaultValue="temp-sal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="temp-sal" className="text-xs">
              <Thermometer className="h-3 w-3 mr-1" />
              T-S
            </TabsTrigger>
            <TabsTrigger
              value="oxygen"
              className="text-xs"
              disabled={!sortedData.some((d) => d.oxygen)}
            >
              <Activity className="h-3 w-3 mr-1" />
              O₂
            </TabsTrigger>
            <TabsTrigger
              value="bio"
              className="text-xs"
              disabled={!sortedData.some((d) => d.chlorophyll)}
            >
              <Droplets className="h-3 w-3 mr-1" />
              Bio
            </TabsTrigger>
            <TabsTrigger value="density" className="text-xs">
              <Gauge className="h-3 w-3 mr-1" />
              Density
            </TabsTrigger>
          </TabsList>

          <TabsContent value="temp-sal" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Temperature Profile</h4>
                <D3ProfileChart
                  data={sortedData}
                  parameters={[tempSalParameters[0]]}
                  width={400}
                  height={400}
                  title="Temperature vs Depth"
                />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Salinity Profile</h4>
                <D3ProfileChart
                  data={sortedData}
                  parameters={[tempSalParameters[1]]}
                  width={400}
                  height={400}
                  title="Salinity vs Depth"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="oxygen" className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Dissolved Oxygen Profile</h4>
              {sortedData.some((d) => d.oxygen) ? (
                <div className="flex justify-center">
                  <D3ProfileChart
                    data={sortedData.filter((d) => d.oxygen)}
                    parameters={oxygenParameters}
                    width={500}
                    height={400}
                    title="Dissolved Oxygen vs Depth"
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No oxygen data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bio" className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Chlorophyll Profile</h4>
              {sortedData.some((d) => d.chlorophyll) ? (
                <div className="flex justify-center">
                  <D3ProfileChart
                    data={sortedData.filter((d) => d.chlorophyll)}
                    parameters={bioParameters}
                    width={500}
                    height={400}
                    title="Chlorophyll vs Depth"
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No chlorophyll data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="density" className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Density Profile</h4>
              <div className="flex justify-center">
                <D3ProfileChart
                  data={sortedData}
                  parameters={densityParameters}
                  width={500}
                  height={400}
                  title="Density vs Depth"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
