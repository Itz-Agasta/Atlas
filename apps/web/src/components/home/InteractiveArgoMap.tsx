"use client";

import dynamic from "next/dynamic";
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

// Dynamically import ArgoVisualizer to avoid SSR issues with Plotly.js
const ArgoVisualizer = dynamic(() => import("../argo"), {
  ssr: false,
  loading: () => (
    <div className="bg-white/95 rounded-xl shadow-lg p-3 min-w-[320px] max-w-[380px] relative">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  ),
});

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
      type="button"
      className={`cursor-pointer transition-transform duration-200 border-none bg-transparent p-0 ${
        isSelected ? "scale-125" : "hover:scale-110"
      }`}
      onClick={(e) => onClick(e.nativeEvent)}
      onMouseEnter={(e) => onHover(e.nativeEvent)}
      onMouseLeave={onHoverEnd}
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
      aria-label={`Argo float ${float.id} at ${float.latitude}, ${float.longitude}`}
    >
      <div className={`relative ${isSelected ? "animate-pulse" : ""}`}>
        {/* Outer glow ring */}
        <div
          className={`absolute inset-0 rounded-full ${
            isSelected ? "bg-yellow-400" : "bg-blue-400"
          } opacity-30 animate-ping`}
        />

        {/* Main marker */}
        <div
          className={`relative w-6 h-6 rounded-full border-2 ${
            isSelected
              ? "bg-yellow-500 border-yellow-700"
              : "bg-blue-500 border-blue-700"
          } shadow-lg flex items-center justify-center`}
        >
          {/* Inner dot */}
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>

        {/* Simple hover label */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 bg-opacity-95 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none backdrop-blur-sm border border-slate-600/50">
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
  const [showProfile, setShowProfile] = useState(false);
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
    setShowProfile(false); // Close profile if open
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
    setSelectedFloat(null);
    setClickPosition(null);
  };

  const handleClosePopup = () => {
    setSelectedFloat(null);
    setClickPosition(null);
  };

  const handleCloseProfile = () => {
    setShowProfile(false);
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
    <div className="relative w-full h-full">
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
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={[]}
        projection={isGlobe ? "globe" : "mercator"}
        onClick={() => {
          // Close popup when clicking on map
          setSelectedFloat(null);
          setClickPosition(null);
          // Close control panel when clicking on map
          setIsControlPanelOpen(false);
        }}
      >
        {/* Map Controls */}
        <GeolocateControl position="top-left" />
        <FullscreenControl position="top-left" />
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Argo Float Markers */}
        {floats.map((float) => (
          <Marker
            key={float.id}
            longitude={float.longitude}
            latitude={float.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(float, e.originalEvent);
            }}
          >
            <ArgoMarker
              float={float}
              onClick={(e) => handleMarkerClick(float, e)}
              onHover={(e) => handleMarkerHover(float, e)}
              onHoverEnd={handleMarkerHoverEnd}
              isSelected={selectedFloat?.id === float.id}
            />
          </Marker>
        ))}
      </MapboxMap>

      {/* Dusky overlay for satellite view */}
      {mapStyle === MAP_STYLES.satellite && (
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "linear-gradient(45deg, rgba(30, 41, 59, 0.15) 0%, rgba(51, 65, 85, 0.25) 50%, rgba(30, 41, 59, 0.15) 100%)",
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* Control Panel */}
      <MapControlPanel
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        isGlobe={isGlobe}
        setIsGlobe={setIsGlobe}
        isOpen={isControlPanelOpen}
        setIsOpen={setIsControlPanelOpen}
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
        position={clickPosition}
        onClose={handleClosePopup}
        onShowProfile={handleShowProfile}
        visible={!!selectedFloat && !!clickPosition}
      />

      {/* Argo Profile Overlay */}
      {showProfile && selectedFloat && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative">
            <ArgoVisualizer onClose={handleCloseProfile} />
          </div>
        </div>
      )}
    </div>
  );
}
