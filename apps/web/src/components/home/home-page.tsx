"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { argoFloatsData } from "@/data/argo-floats2";
import type { ArgoFloat, PopupData, TooltipData } from "@/types/argo";
import ArgoMap from "./argo-map";
import DockNavigation from "./dock-navigation";
import FilterSidebar from "./filter-sidebar";
import FloatPopup from "./float-popup";
import FloatTooltip from "./float-tooltip";
import MapControls, { MAP_STYLES } from "./map-controls";

export default function HomePage() {
  const router = useRouter();

  // State
  const [selectedFloat, setSelectedFloat] = useState<ArgoFloat | null>(null);
  const [hoveredFloat, setHoveredFloat] = useState<ArgoFloat | null>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES.satellite);
  const [isGlobe, setIsGlobe] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Use the data (could be fetched or passed as prop later)
  const floats = argoFloatsData;

  // Handlers
  const handleFloatClick = (
    float: ArgoFloat,
    position: { x: number; y: number }
  ) => {
    setSelectedFloat(float);
    setClickPosition(position);
    setIsControlPanelOpen(false); // Close controls when selecting a float
  };

  const handleFloatHover = (
    float: ArgoFloat | null,
    position: { x: number; y: number } | null
  ) => {
    setHoveredFloat(float);
    setHoverPosition(position);
  };

  const handleMapClick = () => {
    setSelectedFloat(null);
    setClickPosition(null);
    setIsControlPanelOpen(false);
  };

  const handleShowProfile = () => {
    if (selectedFloat) {
      router.push(`/float/${selectedFloat.floatNumber}`);
    }
  };

  const handleClosePopup = () => {
    setSelectedFloat(null);
    setClickPosition(null);
  };

  // Data Selectors
  const getTooltipData = (float: ArgoFloat): TooltipData => ({
    id: float.id,
    longitude: float.longitude,
    latitude: float.latitude,
    date: float.date,
    cycle: float.cycle,
  });

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
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <ArgoMap
          floats={floats}
          isGlobe={isGlobe}
          mapStyle={mapStyle}
          onFloatClick={handleFloatClick}
          onFloatHover={handleFloatHover}
          onMapClick={handleMapClick}
          selectedFloatId={selectedFloat?.id}
        />
      </div>

      {/* UI Overlays */}
      <FilterSidebar className="z-10" />

      {/* Map Controls */}
      <MapControls
        isGlobe={isGlobe}
        isOpen={isControlPanelOpen}
        mapStyle={mapStyle}
        setIsGlobe={setIsGlobe}
        setIsOpen={setIsControlPanelOpen}
        setMapStyle={setMapStyle}
      />

      {/* Navigation */}
      <DockNavigation />

      {/* Interactions */}
      <FloatTooltip
        data={hoveredFloat ? getTooltipData(hoveredFloat) : null}
        position={hoverPosition}
        visible={!!hoveredFloat && !!hoverPosition}
      />

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
