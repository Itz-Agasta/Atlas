"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";

interface TemperatureSalinityChartProps {
  trajectory: FloatTrajectory;
}

export default function TemperatureSalinityChart({
  trajectory,
}: TemperatureSalinityChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || trajectory.points.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 60, bottom: 60, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.bottom - margin.top;

    // Filter points with valid temperature and salinity data
    const validPoints = trajectory.points.filter(
      (point) => point.temperature != null && point.salinity != null,
    );

    if (validPoints.length === 0) return;

    // Create scales
    const salinityExtent = d3.extent(validPoints, (d) => d.salinity || 0) as [
      number,
      number,
    ];
    const temperatureExtent = d3.extent(
      validPoints,
      (d) => d.temperature || 0,
    ) as [number, number];

    const xScale = d3.scaleLinear().domain(salinityExtent).range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain(temperatureExtent)
      .range([height, 0]);

    // Create color scale based on depth
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain(d3.extent(validPoints, (d) => d.depth || 0) as [number, number]);

    // Create main group
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 45)
      .attr("fill", "currentColor")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Salinity (PSU)");

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
      .text("Temperature (°C)");

    // Add circles for data points
    g.selectAll("circle")
      .data(validPoints)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.salinity || 0))
      .attr("cy", (d) => yScale(d.temperature || 0))
      .attr("r", 4)
      .attr("fill", (d) => colorScale(d.depth || 0))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
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
            Temp: ${d.temperature?.toFixed(2)}°C<br/>
            Salinity: ${d.salinity?.toFixed(2)} PSU<br/>
            Depth: ${d.depth?.toFixed(1)}m<br/>
            Date: ${new Date(d.timestamp).toLocaleDateString()}
          `,
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px");
      })
      .on("mouseout", () => {
        d3.selectAll(".d3-tooltip").remove();
      });

    // Add trend line if enough points
    if (validPoints.length > 2) {
      const line = d3
        .line<(typeof validPoints)[0]>()
        .x((d) => xScale(d.salinity || 0))
        .y((d) => yScale(d.temperature || 0))
        .curve(d3.curveCardinal);

      g.append("path")
        .datum(
          validPoints.sort((a, b) => (a.salinity || 0) - (b.salinity || 0)),
        )
        .attr("fill", "none")
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2)
        .attr("opacity", 0.6)
        .attr("d", line);
    }

    // Add legend for depth
    const legendWidth = 200;
    const legendHeight = 10;

    const legendScale = d3
      .scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale).ticks(5);

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
      .attr("id", "depth-gradient")
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
            colorScale.domain()[0] +
              (i / steps) * (colorScale.domain()[1] - colorScale.domain()[0]),
          ),
        );
    }

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#depth-gradient)");

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
      .text("Depth (m)");
  }, [trajectory]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        ref={svgRef}
        width="400"
        height="300"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
