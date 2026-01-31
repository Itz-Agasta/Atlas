"use client";

import { useMemo } from "react";
import {
  FullscreenControl,
  GeolocateControl,
  Map as MapboxMap,
  Marker,
  NavigationControl,
  ScaleControl,
} from "react-map-gl/mapbox";

import "mapbox-gl/dist/mapbox-gl.css";
import { argoFloatsData } from "@/data/argo-floats2";
import type { ArgoFloat } from "@/types/argo";
import Starfield from "../ui/starfield";
import { MAP_STYLES } from "./map-controls";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

type ArgoMapProps = {
  floats?: ArgoFloat[];
  mapStyle: string;
  isGlobe: boolean;
  selectedFloatId?: string;
  onFloatClick: (float: ArgoFloat, position: { x: number; y: number }) => void;
  onFloatHover: (
    float: ArgoFloat | null,
    position: { x: number; y: number } | null
  ) => void;
  onMapClick: () => void;
};

// Custom marker component for Argo floats
function ArgoMarker({
  float,
  isSelected,
  onClick,
  onHover,
  onHoverEnd,
}: {
  float: ArgoFloat;
  isSelected: boolean;
  onClick: (e: MouseEvent) => void;
  onHover: (e: MouseEvent) => void;
  onHoverEnd: () => void;
}) {
  return (
    <button
      aria-label={`Float ${float.floatNumber}`}
      className={`cursor-pointer border-none bg-transparent p-0 transition-transform duration-200 ${
        isSelected ? "z-50 scale-125" : "z-10 hover:scale-110"
      }`}
      onClick={(e) => {
        // Native event needed for position
        onClick(e.nativeEvent);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // Mock event for accessibility
          const rect = e.currentTarget.getBoundingClientRect();
          const mockEvent = new MouseEvent("click", {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          });
          onClick(mockEvent);
        }
      }}
      onMouseEnter={(e) => onHover(e.nativeEvent)}
      onMouseLeave={onHoverEnd}
      type="button"
    >
      <div className={`relative ${isSelected ? "animate-pulse" : ""}`}>
        {/* Outer glow ring */}
        <div
          className={`absolute inset-0 rounded-full ${
            isSelected ? "bg-white" : "bg-green-400"
          } animate-ping opacity-30`}
        />

        {/* Main marker */}
        <div
          className={`relative h-6 w-6 rounded-full border-2 ${
            isSelected
              ? "border-gray-300 bg-white"
              : "border-green-700 bg-green-500"
          } flex items-center justify-center shadow-lg`}
        >
          {/* Inner dot */}
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>

        {/* Simple hover label */}
        <div className="-top-8 -translate-x-1/2 pointer-events-none absolute left-1/2 transform whitespace-nowrap rounded-lg border border-slate-600/50 bg-slate-800 bg-opacity-95 px-3 py-1.5 text-white text-xs opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:opacity-100">
          Float {float.floatNumber}
        </div>
      </div>
    </button>
  );
}

export default function ArgoMap({
  floats = argoFloatsData,
  mapStyle,
  isGlobe,
  selectedFloatId,
  onFloatClick,
  onFloatHover,
  onMapClick,
}: ArgoMapProps) {
  // Calculate the bounds
  const bounds = useMemo(() => {
    if (floats.length === 0) {
      return null;
    }
    const DEFAULT_FLAT_MAP_ZOOM = 4.5;
    return {
      longitude: 75,
      latitude: 8,
      zoom: isGlobe ? 2 : DEFAULT_FLAT_MAP_ZOOM,
    };
  }, [floats.length, isGlobe]);

  // Handle map click
  const handleMapClick = (e: mapboxgl.MapLayerMouseEvent) => {
    // If defaultPrevented is true, it means a marker was clicked
    if (e.originalEvent.defaultPrevented) {
      return;
    }
    onMapClick();
  };

  return (
    <div className="relative h-full w-full">
      {/* Starfield background for globe view */}
      <Starfield isVisible={isGlobe} />

      <MapboxMap
        initialViewState={
          bounds || {
            longitude: 75,
            latitude: 8,
            zoom: 4.5,
          }
        }
        interactiveLayerIds={[]}
        key={isGlobe ? "globe" : "mercator"}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        onClick={handleMapClick}
        projection={{ name: isGlobe ? "globe" : "mercator" }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Map Controls */}
        <GeolocateControl position="top-right" />
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" />
        <ScaleControl position="top-right" />

        {/* Argo Float Markers */}
        {floats.map((float) => (
          <Marker
            anchor="center"
            key={float.id}
            latitude={float.latitude}
            longitude={float.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault(); // prevent map click
              // Click handled by inner element
            }}
          >
            <ArgoMarker
              float={float}
              isSelected={selectedFloatId === float.id}
              onClick={(e) => {
                onFloatClick(float, { x: e.clientX, y: e.clientY });
              }}
              onHover={(e) => {
                onFloatHover(float, { x: e.clientX, y: e.clientY });
              }}
              onHoverEnd={() => {
                onFloatHover(null, null);
              }}
            />
          </Marker>
        ))}
      </MapboxMap>

      {/* Dusky overlay for satellite view */}
      {mapStyle === MAP_STYLES.satellite && (
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{
            background:
              "linear-gradient(45deg, rgba(30, 41, 59, 0.15) 0%, rgba(51, 65, 85, 0.25) 50%, rgba(30, 41, 59, 0.15) 100%)",
            mixBlendMode: "multiply",
          }}
        />
      )}
    </div>
  );
}
