"use client";

import type { Icon, LatLngExpression } from "leaflet";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

interface MiniMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

function CustomMarker() {
  return (
    <div className="relative">
      {/* Blur effect */}
      <div className="absolute inset-0 rounded-full bg-yellow-400/50 blur-md" />
      {/* Outer glow ring */}
      <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400 opacity-30" />

      {/* Main marker */}
      <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-yellow-700 bg-yellow-500 shadow-lg">
        {/* Inner dot */}
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

export function MiniMap({ latitude, longitude, className = "" }: MiniMapProps) {
  const [markerIcon, setMarkerIcon] = useState<Icon | null>(null);
  const center: LatLngExpression = [latitude, longitude];

  useEffect(() => {
    const L = require("leaflet");
    const icon = L.divIcon({
      className: "custom-marker",
      html: `<div class="relative">
              <div class="absolute inset-0 rounded-full bg-yellow-400/50 blur-md"></div>
              <div class="absolute inset-0 rounded-full bg-yellow-400 opacity-30 animate-ping"></div>
              <div class="relative w-6 h-6 rounded-full border-2 bg-yellow-500 border-yellow-700 shadow-lg flex items-center justify-center">
                <div class="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    setMarkerIcon(icon);
  }, []);

  if (!markerIcon) {
    return null; // or a loading state
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-border ${className}`}
      style={{ height: "160px", width: "100%" }}
    >
      <MapContainer
        attributionControl={false}
        center={center}
        doubleClickZoom={true}
        dragging={true}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        zoom={8}
        zoomControl={true}
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <Marker icon={markerIcon} position={center} />
      </MapContainer>

      {/* Overlay with coordinates */}
      <div className="absolute right-1 bottom-1 z-[1000] rounded bg-black/60 px-2 py-1 text-white text-xs backdrop-blur-sm">
        {Math.abs(latitude).toFixed(2)}°{latitude >= 0 ? "N" : "S"}{" "}
        {Math.abs(longitude).toFixed(2)}°{longitude >= 0 ? "E" : "W"}
      </div>
    </div>
  );
}
