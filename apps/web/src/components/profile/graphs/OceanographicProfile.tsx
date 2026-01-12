"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OceanographicData } from "@/data/mockOceanographicData";

interface OceanographicProfileProps {
  data: OceanographicData[];
  parameter: keyof Pick<
    OceanographicData,
    | "temperature"
    | "salinity"
    | "dissolvedOxygen"
    | "chlorophyll"
    | "nitrate"
    | "ph"
    | "cdom"
    | "chlorophyllFluorescence"
    | "particleBackscattering"
  >;
  title: string;
  unit: string;
  color: string;
  width?: number;
  height?: number;
}

export function OceanographicProfile({
  data,
  parameter,
  title,
  unit,
  color,
  width = 400,
  height = 500,
}: OceanographicProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 60, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d[parameter]) as [number, number])
      .range([0, innerWidth])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.depth) as [number, number])
      .range([0, innerHeight]); // Depth increases downward

    // Line generator
    const line = d3
      .line<OceanographicData>()
      .x((d) => xScale(d[parameter] as number))
      .y((d) => yScale(d.depth))
      .curve(d3.curveMonotoneY);

    // Add gradient definition
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", `gradient-${parameter}`)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", innerHeight);

    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.8);

    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color)
      .attr("stop-opacity", 0.2);

    // Add axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format(".2f")).ticks(6);

    const yAxis = d3
      .axisLeft(yScale)
      .tickFormat((d) => `${d}m`)
      .ticks(8);

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#374151");

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#374151");

    // Style axes
    g.selectAll(".domain, .tick line")
      .style("stroke", "#9ca3af")
      .style("stroke-width", 1);

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => ""),
      )
      .style("stroke-dasharray", "2,2")
      .style("opacity", 0.3);

    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .style("stroke-dasharray", "2,2")
      .style("opacity", 0.3);

    // Add the profile line
    const path = g
      .append("path")
      .datum(data)
      .attr("class", "profile-line")
      .attr("d", line)
      .style("fill", "none")
      .style("stroke", color)
      .style("stroke-width", 2.5)
      .style("stroke-linejoin", "round")
      .style("stroke-linecap", "round");

    // Add area under the line
    const area = d3
      .area<OceanographicData>()
      .x((d) => xScale(d[parameter] as number))
      .y0(yScale(0))
      .y1((d) => yScale(d.depth))
      .curve(d3.curveMonotoneY);

    g.append("path")
      .datum(data)
      .attr("class", "profile-area")
      .attr("d", area)
      .style("fill", `url(#gradient-${parameter})`)
      .style("opacity", 0.3);

    // Add data points
    g.selectAll(".data-point")
      .data(data.filter((_, i) => i % 5 === 0)) // Show every 5th point to avoid clutter
      .enter()
      .append("circle")
      .attr("class", "data-point")
      .attr("cx", (d) => xScale(d[parameter] as number))
      .attr("cy", (d) => yScale(d.depth))
      .attr("r", 3)
      .style("fill", color)
      .style("stroke", "white")
      .style("stroke-width", 1.5)
      .style("opacity", 0.8);

    // Add tooltips
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("z-index", "1000");

    g.selectAll(".data-point")
      .on("mouseover", function (_, d) {
        const data = d as OceanographicData;
        tooltip
          .style("visibility", "visible")
          .html(
            `Depth: ${data.depth}m<br/>${title}: ${(data[parameter] as number).toFixed(2)} ${unit}`,
          );
        d3.select(this).attr("r", 5).style("opacity", 1);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
        d3.select(this).attr("r", 3).style("opacity", 0.8);
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

    // Add axis labels
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 20)
      .attr("x", -(height / 2))
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text("Depth (m)");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text(`${title} (${unit})`);

    // Animation
    const totalLength = path.node()?.getTotalLength() || 0;
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };
  }, [data, parameter, title, unit, color, width, height]);

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-4">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-visible"
        />
      </CardContent>
    </Card>
  );
}
