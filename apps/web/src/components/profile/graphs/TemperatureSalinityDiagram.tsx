"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { OceanographicData } from "@/data/mockOceanographicData";

interface TemperatureSalinityDiagramProps {
  data: OceanographicData[];
  width?: number;
  height?: number;
}

export function TemperatureSalinityDiagram({
  data,
  width = 500,
  height = 400,
}: TemperatureSalinityDiagramProps) {
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
      .domain(d3.extent(data, (d) => d.salinity) as [number, number])
      .range([0, innerWidth])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.temperature) as [number, number])
      .range([innerHeight, 0])
      .nice();

    // Color scale based on depth
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain(d3.extent(data, (d) => d.depth) as [number, number]);

    // Add axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format(".1f")).ticks(8);

    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".1f")).ticks(6);

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
      .style("opacity", 0.2);

    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .style("stroke-dasharray", "2,2")
      .style("opacity", 0.2);

    // Add data points
    const points = g
      .selectAll(".data-point")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "data-point")
      .attr("cx", (d) => xScale(d.salinity))
      .attr("cy", (d) => yScale(d.temperature))
      .attr("r", 0)
      .style("fill", (d) => colorScale(d.depth))
      .style("stroke", "white")
      .style("stroke-width", 0.5)
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

    points
      .on("mouseover", function (_, d) {
        tooltip
          .style("visibility", "visible")
          .html(
            `Depth: ${d.depth}m<br/>Temperature: ${d.temperature.toFixed(2)}°C<br/>Salinity: ${d.salinity.toFixed(2)} PSU`,
          );
        d3.select(this).attr("r", 6).style("stroke-width", 2);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
        d3.select(this).attr("r", 4).style("stroke-width", 0.5);
      });

    // Animate points
    points
      .transition()
      .duration(1000)
      .delay((_, i) => i * 2)
      .attr("r", 4);

    // Add density contours for water masses (simplified)
    const contourData = [];
    for (let i = 0; i < 5; i++) {
      contourData.push({
        salinity: 34.5 + i * 0.1,
        temperature: 25 - i * 3,
        density: 1024 + i * 0.5,
      });
    }

    // Add title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#1f2937")
      .text("Temperature-Salinity Diagram");

    // Add axis labels
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 20)
      .attr("x", -(height / 2))
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text("Temperature (°C)");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#374151")
      .text("Salinity (PSU)");

    // Add color legend
    const legendHeight = 200;
    const legendWidth = 20;
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 80}, ${margin.top})`);

    const legendScale = d3
      .scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendHeight]);

    const legendAxis = d3
      .axisRight(legendScale)
      .tickFormat((d) => `${d}m`)
      .ticks(5);

    // Create gradient for legend
    const legendGradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", legendHeight);

    const colorRange = d3.range(0, 1.01, 0.01);
    legendGradient
      .selectAll("stop")
      .data(colorRange)
      .enter()
      .append("stop")
      .attr("offset", (d) => `${d * 100}%`)
      .attr("stop-color", (d) =>
        colorScale(legendScale.invert(d * legendHeight)),
      );

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    legend
      .append("g")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "10px")
      .style("fill", "#374151");

    legend
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -10)
      .attr("x", -legendHeight / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#374151")
      .text("Depth");

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };
  }, [data, width, height]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible w-full h-full"
      />
    </div>
  );
}
