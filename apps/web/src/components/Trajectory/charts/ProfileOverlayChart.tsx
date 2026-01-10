"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";

interface ProfileOverlayChartProps {
  trajectory: FloatTrajectory;
}

export default function ProfileOverlayChart({
  trajectory,
}: ProfileOverlayChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || trajectory.points.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 60, bottom: 60, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.bottom - margin.top;

    // Filter points with valid temperature and depth data
    const validPoints = trajectory.points.filter(
      (point) => point.temperature != null && point.depth != null,
    );

    if (validPoints.length === 0) return;

    // Create scales
    const temperatureExtent = d3.extent(
      validPoints,
      (d) => d.temperature || 0,
    ) as [number, number];
    const depthExtent = d3.extent(validPoints, (d) => d.depth || 0) as [
      number,
      number,
    ];

    const xScale = d3.scaleLinear().domain(temperatureExtent).range([0, width]);

    const yScale = d3.scaleLinear().domain(depthExtent).range([0, height]); // Depth increases downward

    // Create color scale based on time
    const timeExtent = d3.extent(validPoints, (d) =>
      new Date(d.timestamp).getTime(),
    ) as [number, number];
    const colorScale = d3
      .scaleSequential(d3.interpolatePlasma)
      .domain(timeExtent);

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
      .text("Temperature (°C)");

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

    // Group points by profile (assuming each 10 points is a profile)
    const profileSize = 5;
    const profiles: (typeof validPoints)[] = [];
    for (let i = 0; i < validPoints.length; i += profileSize) {
      const profile = validPoints.slice(i, i + profileSize);
      if (profile.length > 1) {
        profiles.push(profile.sort((a, b) => (a.depth || 0) - (b.depth || 0)));
      }
    }

    // Draw profile lines
    profiles.forEach((profile, profileIndex) => {
      const line = d3
        .line<(typeof profile)[0]>()
        .x((d) => xScale(d.temperature || 0))
        .y((d) => yScale(d.depth || 0))
        .curve(d3.curveMonotoneY);

      const profileTime = new Date(profile[0].timestamp).getTime();

      g.append("path")
        .datum(profile)
        .attr("fill", "none")
        .attr("stroke", colorScale(profileTime))
        .attr("stroke-width", 2)
        .attr("opacity", 0.7)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("mouseover", (event) => {
          // Highlight this profile
          d3.select(event.currentTarget)
            .attr("stroke-width", 3)
            .attr("opacity", 1);

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
              <strong>Profile ${profileIndex + 1}</strong><br/>
              Date: ${new Date(profile[0].timestamp).toLocaleDateString()}<br/>
              Depth Range: ${Math.min(...profile.map((p) => p.depth || 0)).toFixed(1)}m - ${Math.max(...profile.map((p) => p.depth || 0)).toFixed(1)}m<br/>
              Temp Range: ${Math.min(...profile.map((p) => p.temperature || 0)).toFixed(2)}°C - ${Math.max(...profile.map((p) => p.temperature || 0)).toFixed(2)}°C
            `,
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
        })
        .on("mouseout", (event) => {
          // Reset highlight
          d3.select(event.currentTarget)
            .attr("stroke-width", 2)
            .attr("opacity", 0.7);

          d3.selectAll(".d3-tooltip").remove();
        });

      // Add circles at data points for this profile
      g.selectAll(`.profile-${profileIndex}-points`)
        .data(profile)
        .enter()
        .append("circle")
        .attr("class", `profile-${profileIndex}-points`)
        .attr("cx", (d) => xScale(d.temperature || 0))
        .attr("cy", (d) => yScale(d.depth || 0))
        .attr("r", 2)
        .attr("fill", colorScale(profileTime))
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("opacity", 0.8);
    });

    // Add legend for time
    const legendWidth = 200;
    const legendHeight = 10;

    const legendScale = d3
      .scaleTime()
      .domain(timeExtent)
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(3)
      .tickFormat((d) => {
        return d3.timeFormat("%b %d")(new Date(d as number));
      });

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
      .attr("id", "time-gradient")
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
            timeExtent[0] + (i / steps) * (timeExtent[1] - timeExtent[0]),
          ),
        );
    }

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#time-gradient)");

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
      .text("Profile Date");
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
