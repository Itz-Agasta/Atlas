"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import type { TrajectoryPoint } from "@/data/mockTrajectoryData";

interface AnimatedTrajectoryProps {
  points: TrajectoryPoint[];
  animationDuration?: number;
  strokeColor?: string;
  strokeWidth?: number;
  showProgressMarkers?: boolean;
  onAnimationComplete?: () => void;
}

export default function AnimatedTrajectory({
  points,
  animationDuration = 4000,
  strokeColor = "#3b82f6",
  strokeWidth = 3,
  showProgressMarkers = true,
  onAnimationComplete,
}: AnimatedTrajectoryProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const map = useMap();
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    if (!map || !svgRef.current || points.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Get map container dimensions
    const mapContainer = map.getContainer();
    const { width, height } = mapContainer.getBoundingClientRect();

    svg
      .attr("width", width)
      .attr("height", height)
      .style("position", "absolute")
      .style("top", 0)
      .style("left", 0)
      .style("pointer-events", "none")
      .style("z-index", 1000);

    // Convert lat/lng points to pixel coordinates
    const convertToPixel = (point: TrajectoryPoint) => {
      const pixelPoint = map.latLngToContainerPoint([
        point.latitude,
        point.longitude,
      ]);
      return [pixelPoint.x, pixelPoint.y];
    };

    const pixelPoints = points.map(convertToPixel);

    // Create line generator
    const line = d3
      .line<number[]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveLinear);

    // Create the main path
    const mainPath = svg
      .append("path")
      .datum(pixelPoints)
      .attr("fill", "none")
      .attr("stroke", strokeColor)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.8)
      .attr("d", line);

    // Create markers group
    const markersGroup = svg.append("g").attr("class", "trajectory-markers");

    // Add start marker (no text)
    const [startX, startY] = pixelPoints[0];
    markersGroup
      .append("circle")
      .attr("cx", startX)
      .attr("cy", startY)
      .attr("r", 6)
      .attr("fill", "#22c55e")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", 1);

    // Get path length and set up animation
    const pathElement = mainPath.node() as SVGPathElement;
    const totalLength = pathElement?.getTotalLength() || 0;

    if (totalLength === 0) {
      onAnimationComplete?.();
      return;
    }

    // Set up the main line animation
    mainPath
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(animationDuration)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0)
      .tween("progress", () => (t) => {
        setAnimationProgress(t);

        // Show progress markers during animation
        if (showProgressMarkers && t > 0) {
          const currentLength = totalLength * t;
          const currentPoint = pathElement.getPointAtLength(currentLength);

          // Update or create progress marker
          let progressMarker = svg.select<SVGCircleElement>(".progress-marker");
          if (progressMarker.empty()) {
            progressMarker = svg
              .append("circle")
              .attr("class", "progress-marker")
              .attr("r", 4)
              .attr("fill", "#ff6600")
              .attr("stroke", "white")
              .attr("stroke-width", 1)
              .attr("opacity", 0.9);
          }

          progressMarker.attr("cx", currentPoint.x).attr("cy", currentPoint.y);
        }
      })
      .on("end", () => {
        // Remove progress marker and add end marker
        svg.select(".progress-marker").remove();

        const [endX, endY] = pixelPoints[pixelPoints.length - 1];
        markersGroup
          .append("circle")
          .attr("cx", endX)
          .attr("cy", endY)
          .attr("r", 6)
          .attr("fill", "#ef4444")
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .attr("opacity", 0)
          .transition()
          .duration(300)
          .attr("opacity", 1);

        // Make line solid and complete
        mainPath.attr("stroke-dasharray", "none");
        onAnimationComplete?.();
      });

    // Update on map changes
    const updateVisualization = () => {
      if (!svg.node()) return;

      const updatedPixelPoints = points.map(convertToPixel);
      mainPath.datum(updatedPixelPoints).attr("d", line);

      // Update markers
      const [newStartX, newStartY] = updatedPixelPoints[0];
      markersGroup.select("circle").attr("cx", newStartX).attr("cy", newStartY);
      markersGroup
        .select("text")
        .attr("x", newStartX)
        .attr("y", newStartY - 12);
    };

    const handleViewReset = () => {
      const { width: newWidth, height: newHeight } =
        mapContainer.getBoundingClientRect();
      svg.attr("width", newWidth).attr("height", newHeight);
      updateVisualization();
    };

    map.on("viewreset", handleViewReset);
    map.on("zoom", updateVisualization);
    map.on("move", updateVisualization);

    return () => {
      map.off("viewreset", handleViewReset);
      map.off("zoom", updateVisualization);
      map.off("move", updateVisualization);
    };
  }, [
    map,
    points,
    animationDuration,
    strokeColor,
    strokeWidth,
    showProgressMarkers,
    onAnimationComplete,
  ]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    />
  );
}
