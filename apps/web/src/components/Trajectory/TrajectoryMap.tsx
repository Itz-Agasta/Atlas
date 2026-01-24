"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";
import TrajectoryPointHover from "./TrajectoryPointHover";

interface TrajectoryMapProps {
  trajectory: FloatTrajectory;
}

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  { ssr: false }
);

// Dynamically import the animated component
const AnimatedTrajectory = dynamic(() => import("./AnimatedTrajectory"), {
  ssr: false,
  loading: () => null,
});

// Custom numbered marker icon
const createNumberedIcon = (number: number, isStart = false, isEnd = false) => {
  if (typeof window === "undefined") return null;
  const L = require("leaflet");

  let color = "#3b82f6"; // Default blue
  if (isStart) color = "#22c55e"; // Green for start
  if (isEnd) color = "#ef4444"; // Red for end

  return new L.Icon({
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="12" fill="${color}" stroke="white" stroke-width="3"/>
        <text x="15" y="20" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${number}</text>
      </svg>
    `),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

export default function TrajectoryMap({ trajectory }: TrajectoryMapProps) {
  const [showStaticLine, setShowStaticLine] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);

  // Calculate map bounds
  const bounds =
    trajectory.points.length > 0
      ? ([
          [
            Math.min(...trajectory.points.map((p) => p.latitude)),
            Math.min(...trajectory.points.map((p) => p.longitude)),
          ],
          [
            Math.max(...trajectory.points.map((p) => p.latitude)),
            Math.max(...trajectory.points.map((p) => p.longitude)),
          ],
        ] as [[number, number], [number, number]])
      : ([
          [10, 60],
          [25, 100],
        ] as [[number, number], [number, number]]);

  const center =
    trajectory.points.length > 0
      ? ([trajectory.points[0].latitude, trajectory.points[0].longitude] as [
          number,
          number,
        ])
      : ([15, 80] as [number, number]);

  const trajectoryPath = trajectory.points.map(
    (point) => [point.latitude, point.longitude] as [number, number]
  );

  const handleAnimationComplete = () => {
    setAnimationCompleted(true);
    setShowStaticLine(true);
  };

  useEffect(() => {
    // Fix for default markers
    if (typeof window !== "undefined") {
      // biome-ignore lint/suspicious/noExplicitAny: Required for Leaflet icon fix
      delete (window as any).L;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require("leaflet");
      // biome-ignore lint/suspicious/noExplicitAny: Required for Leaflet icon fix
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    }
  }, []);

  return (
    <MapContainer
      bounds={bounds}
      center={center}
      className="trajectory-map"
      style={{ height: "100%", width: "100%" }}
      zoom={6}
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />

      {/* Animated Trajectory Line */}
      {trajectory.points.length > 1 && !animationCompleted && (
        <AnimatedTrajectory
          animationDuration={7000}
          onAnimationComplete={handleAnimationComplete}
          points={trajectory.points}
          showProgressMarkers={true}
          strokeColor="#3b82f6"
          strokeWidth={3}
        />
      )}

      {/* Static Trajectory Line (shown after animation) */}
      {trajectoryPath.length > 1 && showStaticLine && (
        <Polyline
          color="#3b82f6"
          opacity={0.8}
          positions={trajectoryPath}
          weight={3}
        />
      )}

      {/* Numbered Trajectory Markers - only shown after animation */}
      {animationCompleted &&
        trajectory.points.map((point, index) => {
          const pointNumber = index + 1;
          const isStart = index === 0;
          const isEnd = index === trajectory.points.length - 1;
          const icon = createNumberedIcon(pointNumber, isStart, isEnd);

          if (!icon) return null;

          return (
            <Marker
              icon={icon}
              key={`point-${point.timestamp}-${index}`}
              position={[point.latitude, point.longitude]}
            >
              <Tooltip direction="left" offset={[10, 0]} opacity={1}>
                <div className="p-0">
                  <TrajectoryPointHover
                    isEnd={isEnd}
                    isStart={isStart}
                    point={point}
                    pointNumber={pointNumber}
                  />
                </div>
              </Tooltip>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
