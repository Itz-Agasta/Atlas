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

import { argoFloatsData } from "@/data/argoFloats2";
import type { ArgoFloat, PopupData, TooltipData } from "@/types/argo";
import Starfield from "../ui/Starfield";
import FloatPopup from "./FloatPopup";
import FloatTooltip from "./FloatTooltip";
import MapControlPanel, { MAP_STYLES } from "./MapControlPanel";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface InteractiveArgoMapProps {
  floats?: ArgoFloat[];
}

// Custom marker component for Argo floats
function ArgoMarker({
  float,
  onClick,
  onHover,
  onHoverEnd,
  isSelected,
}: {
  float: ArgoFloat;
  onClick: (e: MouseEvent) => void;
  onHover: (e: MouseEvent) => void;
  onHoverEnd: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      aria-label={`Argo float ${float.id} at ${float.latitude}, ${float.longitude}`}
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
          Float {float.floatNumber}
        </div>
      </div>
    </button>
  );
}

export default function InteractiveArgoMap({
  floats = argoFloatsData,
}: InteractiveArgoMapProps) {
  const router = useRouter();
  const [selectedFloat, setSelectedFloat] = useState<ArgoFloat | null>(null);
  const [hoveredFloat, setHoveredFloat] = useState<ArgoFloat | null>(null);
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
    if (floats.length === 0) return null;

    // Center on Indian Ocean with appropriate zoom
    return {
      longitude: 75, // Central Indian Ocean longitude
      latitude: 8, // Slightly north for better view of India's coast
      zoom: isGlobe ? 2 : 4.5,
    };
  }, [floats, isGlobe]);

  const handleMarkerClick = (float: ArgoFloat, event: MouseEvent) => {
    setSelectedFloat(float);
    setClickPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMarkerHover = (float: ArgoFloat, event: MouseEvent) => {
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
      router.push(`/float/${selectedFloat.floatNumber}`);
    }
  };

  const handleClosePopup = () => {
    setSelectedFloat(null);
    setClickPosition(null);
  };

  // Convert ArgoFloat to TooltipData
  const getTooltipData = (float: ArgoFloat): TooltipData => ({
    id: float.id,
    longitude: float.longitude,
    latitude: float.latitude,
    date: float.date,
    cycle: float.cycle,
  });

  // Convert ArgoFloat to PopupData
  const getPopupData = (float: ArgoFloat): PopupData => ({
    floatNumber: float.floatNumber,
    cycle: float.cycle,
    date: float.date,
    platformType: float.platformType,
    pi: float.pi,
    telecomCode: float.telecomCode,
    sensors: float.sensors,
  });

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
        {floats.map((float) => (
          <Marker
            anchor="center"
            key={float.id}
            latitude={float.latitude}
            longitude={float.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(float, e.originalEvent);
            }}
          >
            <ArgoMarker
              float={float}
              isSelected={selectedFloat?.id === float.id}
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
