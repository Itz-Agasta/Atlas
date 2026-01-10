"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { OceanographicData } from "@/data/mockOceanographicData";

interface MultiParameterProfileProps {
  data: OceanographicData[];
  parameters: Array<{
    key: keyof OceanographicData;
    name: string;
    color: string;
    unit: string;
  }>;
  width?: number;
  height?: number;
}

export function MultiParameterProfile({
  data,
  parameters,
  width = 600,
  height = 500,
}: MultiParameterProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length || !parameters.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
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
    const normalizedScales = parameters.map((param) => {
      const extent = d3.extent(data, (d) => d[param.key] as number) as [
        number,
        number,
      ];
      return {
        ...param,
        scale: d3.scaleLinear().domain(extent).range([0, 1]),
        originalExtent: extent,
      };
    });

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

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
      .style("opacity", 0.2);

    g.selectAll(".domain, .tick line")
      .style("stroke", "#9ca3af")
      .style("stroke-width", 1);

    // Create lines for each parameter
    normalizedScales.forEach((param, paramIndex) => {
      const paramLine = d3
        .line<OceanographicData>()
        .x((d) => xScale(param.scale(d[param.key] as number)))
        .y((d) => yScale(d.depth))
        .curve(d3.curveMonotoneY);

      // Add the line
      const path = g
        .append("path")
        .datum(data)
        .attr("class", `profile-line-${paramIndex}`)
        .attr("d", paramLine)
        .style("fill", "none")
        .style("stroke", param.color)
        .style("stroke-width", 2)
        .style("opacity", 0.8);

      // Add data points
      g.selectAll(`.data-point-${paramIndex}`)
        .data(data.filter((_, i) => i % 8 === 0)) // Show fewer points to avoid clutter
        .enter()
        .append("circle")
        .attr("class", `data-point-${paramIndex}`)
        .attr("cx", (d) => xScale(param.scale(d[param.key] as number)))
        .attr("cy", (d) => yScale(d.depth))
        .attr("r", 3)
        .style("fill", param.color)
        .style("stroke", "white")
        .style("stroke-width", 1)
        .style("opacity", 0.7);

      // Animation
      const totalLength = path.node()?.getTotalLength() || 0;
      path
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2000)
        .delay(paramIndex * 300)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
    });

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

    // Add interaction area for all points
    g.selectAll('[class*="data-point-"]')
      .on("mouseover", function (_, d) {
        const data = d as OceanographicData;
        const parameterInfo = normalizedScales
          .map(
            (param) =>
              `${param.name}: ${(data[param.key] as number).toFixed(2)} ${param.unit}`,
          )
          .join("<br/>");

        tooltip
          .style("visibility", "visible")
          .html(`Depth: ${data.depth}m<br/>${parameterInfo}`);

        d3.select(this).attr("r", 5).style("opacity", 1);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
        d3.select(this).attr("r", 3).style("opacity", 0.7);
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
      .text("Multi-Parameter Depth Profile");

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
      .attr("transform", `translate(${width - 120}, ${margin.top})`);

    normalizedScales.forEach((param, i) => {
      const legendItem = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 45})`);

      legendItem
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .style("stroke", param.color)
        .style("stroke-width", 3);

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
          `${param.originalExtent[0].toFixed(1)}-${param.originalExtent[1].toFixed(1)}`
        );
      
      // Add unit on another line
      legendItem
        .append("text")
        .attr("x", 25)
        .attr("y", 26)
        .style("font-size", "9px")
        .style("fill", "#6b7280")
        .text(param.unit);
    });

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };
  }, [data, parameters, width, height]);

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
