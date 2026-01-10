"use client";

import { Map } from "@/components/ui/map";

const satelliteStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256
    }
  },
  layers: [{
    id: 'satellite',
    type: 'raster',
    source: 'satellite'
  }]
};

interface SatelliteMapProps {
  center?: [number, number];
  zoom?: number;
  style?: React.CSSProperties;
}

export default function SatelliteMap({ center = [0, 0], zoom = 2, style }: SatelliteMapProps) {
  return (
    <Map
      center={center}
      zoom={zoom}
      styles={{ light: satelliteStyle, dark: satelliteStyle }}
      style={style}
    />
  );
}