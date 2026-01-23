"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FullscreenControl,
  GeolocateControl,
  Map as MapboxMap,
  Marker,
  NavigationControl,
  ScaleControl,
} from "react-map-gl/mapbox";

// Import the CSS for mapbox-gl
import "mapbox-gl/dist/mapbox-gl.css";

import type { FloatLocationsResponse } from "@atlas/schema/api/home-page";
import Starfield from "../ui/Starfield";
import FloatPopup from "./float-popup";
import FloatTooltip from "./float-tooltip";
import MapControlPanel, { MAP_STYLES } from "./map-control-panel";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Type for float location from API
type FloatLocation = FloatLocationsResponse["data"][number];

type InteractiveArgoMapProps = {
  floatLocations?: FloatLocation[];
  isLoading?: boolean;
  error?: string | null;
};

// Custom marker component for Argo floats
function ArgoMarker({
  float,
  onClick,
  onHover,
  onHoverEnd,
  isSelected,
}: {
  float: FloatLocation;
  onClick: (e: MouseEvent) => void;
  onHover: (e: MouseEvent) => void;
  onHoverEnd: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      aria-label={`Argo float ${float.floatId} at ${float.latitude}, ${float.longitude}`}
      className={`cursor-pointer border-none bg-transparent p-0 transition-transform duration-200 ${
        isSelected ? "scale-125" : "hover:scale-110"
      }`}
      onClick={(e) => onClick(e.nativeEvent)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // For keyboard events, just call the click handler with a simulated mouse event
          const rect = e.currentTarget.getBoundingClientRect();
          const simulatedEvent = new MouseEvent("click", {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          });
          onClick(simulatedEvent);
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
          Float {float.floatId}
        </div>
      </div>
    </button>
  );
}

export default function InteractiveArgoMap({
  floatLocations = [],
  isLoading = false,
  error = null,
}: InteractiveArgoMapProps) {
  const router = useRouter();
  const [selectedFloat, setSelectedFloat] = useState<FloatLocation | null>(null);
  const [hoveredFloat, setHoveredFloat] = useState<FloatLocation | null>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES.satellite);
  const [isGlobe, setIsGlobe] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

  // FIXME: Have to change this later
  // Calculate the bounds to fit all floats (focused on Indian Ocean)
  const bounds = useMemo(() => {
    if (floatLocations.length === 0) {
      return null;
    }

    // Center on Indian Ocean with appropriate zoom
    const DEFAULT_FLAT_MAP_ZOOM = 4.5;
    return {
      longitude: 75, // Central Indian Ocean longitude
      latitude: 8, // Slightly north for better view of India's coast
      zoom: isGlobe ? 2 : DEFAULT_FLAT_MAP_ZOOM,
    };
  }, [floatLocations, isGlobe]);

  const handleMarkerClick = (float: FloatLocation, event: MouseEvent) => {
    setSelectedFloat(float);
    setClickPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMarkerHover = (float: FloatLocation, event: MouseEvent) => {
    setHoveredFloat(float);
    setHoverPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMarkerHoverEnd = () => {
    setHoveredFloat(null);
    setHoverPosition(null);
  };

  const handleShowProfile = () => {
    if (selectedFloat) {
      // Navigate to the float profile page
      router.push(`/float/${selectedFloat.floatId}`);
    }
  };

  const handleClosePopup = () => {
    setSelectedFloat(null);
    setClickPosition(null);
  };

  // Convert FloatLocation to TooltipData
  const getTooltipData = (float: FloatLocation) => ({
    id: String(float.floatId),
    longitude: float.longitude,
    latitude: float.latitude,
    date: float.lastUpdate || "",
    cycle: float.cycleNumber || 0,
  });

  // Convert FloatLocation to PopupData
  const getPopupData = (float: FloatLocation) => ({
    floatNumber: String(float.floatId),
    cycle: float.cycleNumber || 0,
    date: float.lastUpdate || "",
    platformType: "Unknown",
    pi: "Unknown",
    telecomCode: "Unknown",
    sensors: [] as string[],
  });

  return (
    <div className="relative h-full w-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="text-white text-lg">Loading float locations...</div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-md">
          {error}
        </div>
      )}

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
        onClick={() => {
          // Close popup when clicking on map
          setSelectedFloat(null);
          setClickPosition(null);
          // Close control panel when clicking on map
          setIsControlPanelOpen(false);
        }}
        projection={{ name: isGlobe ? "globe" : "mercator" }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Map Controls */}
        <GeolocateControl position="top-right" />
        <FullscreenControl position="top-right" />
        <NavigationControl position="top-right" />
        <ScaleControl position="top-right" />

        {/* Argo Float Markers */}
        {floatLocations.map((float) => (
          <Marker
            anchor="center"
            key={float.floatId}
            latitude={float.latitude}
            longitude={float.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(float, e.originalEvent);
            }}
          >
            <ArgoMarker
              float={float}
              isSelected={selectedFloat?.floatId === float.floatId}
              onClick={(e) => handleMarkerClick(float, e)}
              onHover={(e) => handleMarkerHover(float, e)}
              onHoverEnd={handleMarkerHoverEnd}
            />
          </Marker>
        ))}
      </MapboxMap>

      {/* Dusky overlay for satellite view */}
      {mapStyle === MAP_STYLES.satellite && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(45deg, rgba(30, 41, 59, 0.15) 0%, rgba(51, 65, 85, 0.25) 50%, rgba(30, 41, 59, 0.15) 100%)",
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* Control Panel */}
      <MapControlPanel
        isGlobe={isGlobe}
        isOpen={isControlPanelOpen}
        mapStyle={mapStyle}
        setIsGlobe={setIsGlobe}
        setIsOpen={setIsControlPanelOpen}
        setMapStyle={setMapStyle}
      />

      {/* Hover Tooltip */}
      <FloatTooltip
        data={hoveredFloat ? getTooltipData(hoveredFloat) : null}
        position={hoverPosition}
        visible={!!hoveredFloat && !!hoverPosition}
      />

      {/* Click Popup */}
      <FloatPopup
        data={selectedFloat ? getPopupData(selectedFloat) : null}
        onClose={handleClosePopup}
        onShowProfile={handleShowProfile}
        position={clickPosition}
        visible={!!selectedFloat && !!clickPosition}
      />
    </div>
  );
}
