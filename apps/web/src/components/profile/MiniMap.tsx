"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Icon, LatLngExpression } from "leaflet";
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
      <div className="absolute inset-0 rounded-full bg-yellow-400 opacity-30 animate-ping" />

      {/* Main marker */}
      <div className="relative w-6 h-6 rounded-full border-2 bg-yellow-500 border-yellow-700 shadow-lg flex items-center justify-center">
        {/* Inner dot */}
        <div className="w-2 h-2 bg-white rounded-full" />
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
      className: 'custom-marker',
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
        center={center}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true} 
        dragging={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        attributionControl={false}
      >
        <TileLayer 
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        />
        <Marker position={center} icon={markerIcon} />
      </MapContainer>

      {/* Overlay with coordinates */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-[1000]">
        {Math.abs(latitude).toFixed(2)}°{latitude >= 0 ? "N" : "S"}{" "}
        {Math.abs(longitude).toFixed(2)}°{longitude >= 0 ? "E" : "W"}
      </div>
    </div>
  );
}
