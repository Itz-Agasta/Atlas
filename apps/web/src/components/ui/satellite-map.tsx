"use client";
import type { StyleSpecification } from "maplibre-gl";
// map libre gl component for alternative options
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
} from "@/components/ui/map";

const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

// Random marker locations around the world
const randomMarkers = [
  { id: 1, longitude: -122.4194, latitude: 37.7749, label: "San Francisco" },
  { id: 2, longitude: -73.9857, latitude: 40.7484, label: "New York" },
  { id: 3, longitude: -0.1276, latitude: 51.5074, label: "London" },
  { id: 4, longitude: 139.6917, latitude: 35.6895, label: "Tokyo" },
  { id: 5, longitude: 151.2093, latitude: -33.8688, label: "Sydney" },
  { id: 6, longitude: 2.3522, latitude: 48.8566, label: "Paris" },
  { id: 7, longitude: -43.1729, latitude: -22.9068, label: "Rio de Janeiro" },
  { id: 8, longitude: 77.209, latitude: 28.6139, label: "New Delhi" },
];

interface SatelliteMapProps {
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function SatelliteMap({
  center = [0, 0],
  zoom = 2,
  style,
  children,
}: SatelliteMapProps) {
  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      <Map
        center={center}
        styles={{ light: satelliteStyle, dark: satelliteStyle }}
        zoom={zoom}
      >
        <MapControls position="top-right" showZoom={true} />
        {randomMarkers.map((marker) => (
          <MapMarker
            key={marker.id}
            latitude={marker.latitude}
            longitude={marker.longitude}
          >
            <MarkerContent />
          </MapMarker>
        ))}
        {children}
      </Map>
    </div>
  );
}
