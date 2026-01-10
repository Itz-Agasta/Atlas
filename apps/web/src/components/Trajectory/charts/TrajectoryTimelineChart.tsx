"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";

interface TrajectoryTimelineChartProps {
  trajectory: FloatTrajectory;
}

export default function TrajectoryTimelineChart({
  trajectory,
}: TrajectoryTimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || trajectory.points.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 60, bottom: 60, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 200 - margin.bottom - margin.top;

    // Parse dates and create scales
    const parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");
    const validPoints = trajectory.points.filter((point) => point.timestamp);

    const timeExtent = d3.extent(
      validPoints,
      (d) => parseTime(d.timestamp.slice(0, -1) + ".000Z") || new Date(),
    ) as [Date, Date];
    const depthExtent = d3.extent(validPoints, (d) => d.depth || 0) as [
      number,
      number,
    ];

    const xScale = d3.scaleTime().domain(timeExtent).range([0, width]);

    const yScale = d3.scaleLinear().domain(depthExtent).range([height, 0]); // Depth increases downward (but display upward for readability)

    // Create color scale for temperature
    const temperatureExtent = d3.extent(
      validPoints,
      (d) => d.temperature || 0,
    ) as [number, number];
    const colorScale = d3
      .scaleSequential(d3.interpolateRdYlBu)
      .domain(temperatureExtent);

    // Create main group
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 45)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Date");

    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(yScale))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -height / 2)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Depth (m)");

    // Add line connecting points
    const line = d3
      .line<(typeof validPoints)[0]>()
      .x((d) =>
        xScale(parseTime(d.timestamp.slice(0, -1) + ".000Z") || new Date()),
      )
      .y((d) => yScale(d.depth || 0))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(validPoints)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("opacity", 0.6)
      .attr("d", line);

    // Add circles for data points
    g.selectAll("circle")
      .data(validPoints)
      .enter()
      .append("circle")
      .attr("cx", (d) =>
        xScale(parseTime(d.timestamp.slice(0, -1) + ".000Z") || new Date()),
      )
      .attr("cy", (d) => yScale(d.depth || 0))
      .attr("r", 4)
      .attr("fill", (d) => colorScale(d.temperature || 0))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        // Highlight point
        d3.select(event.currentTarget).attr("r", 6).attr("stroke-width", 3);

        // Create tooltip
        const tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "d3-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000");

        tooltip
          .html(
            `
            <strong>Point ${d.id}</strong><br/>
            Date: ${new Date(d.timestamp).toLocaleDateString()}<br/>
            Depth: ${d.depth?.toFixed(1)}m<br/>
            Temp: ${d.temperature?.toFixed(2)}°C<br/>
            Salinity: ${d.salinity?.toFixed(2)} PSU
          `,
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px");
      })
      .on("mouseout", (event) => {
        // Reset highlight
        d3.select(event.currentTarget).attr("r", 4).attr("stroke-width", 2);

        d3.selectAll(".d3-tooltip").remove();
      });

    // Add temperature legend
    const legendWidth = 150;
    const legendHeight = 10;

    const legendScale = d3
      .scaleLinear()
      .domain(temperatureExtent)
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(3)
      .tickFormat((d) => `${d}°C`);

    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + width - legendWidth}, ${height + margin.top + 40})`,
      );

    // Create gradient for legend
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "temp-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      gradient
        .append("stop")
        .attr("offset", `${(i / steps) * 100}%`)
        .attr(
          "stop-color",
          colorScale(
            temperatureExtent[0] +
              (i / steps) * (temperatureExtent[1] - temperatureExtent[0]),
          ),
        );
    }

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#temp-gradient)");

    legend
      .append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis);

    legend
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -5)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .text("Temperature");
  }, [trajectory]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        ref={svgRef}
        width="600"
        height="250"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
