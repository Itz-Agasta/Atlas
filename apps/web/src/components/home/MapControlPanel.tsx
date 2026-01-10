"use client";

import { argoFloatsData } from "@/data/argoFloats";

// Map style options
const MAP_STYLES = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12", // Dusky satellite with labels
  dark: "mapbox://styles/mapbox/dark-v11",
  outdoors: "mapbox://styles/mapbox/outdoors-v11",
};

interface MapControlPanelProps {
  mapStyle: string;
  setMapStyle: (style: string) => void;
  isGlobe: boolean;
  setIsGlobe: (globe: boolean) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function MapControlPanel({
  mapStyle,
  setMapStyle,
  isGlobe,
  setIsGlobe,
  isOpen,
  setIsOpen,
}: MapControlPanelProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10">
      {/* Hamburger Menu Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-background/95 dark:bg-background/95 rounded-xl p-3 shadow-xl hover:bg-background transition-all duration-200 mb-2 border border-border backdrop-blur-sm"
        aria-label="Toggle map controls"
      >
        <div className="space-y-1">
          <div
            className={`w-5 h-0.5 bg-foreground transition-transform duration-200 ${isOpen ? "rotate-45 translate-y-1.5" : ""}`}
          />
          <div
            className={`w-5 h-0.5 bg-foreground transition-opacity duration-200 ${isOpen ? "opacity-0" : ""}`}
          />
          <div
            className={`w-5 h-0.5 bg-foreground transition-transform duration-200 ${isOpen ? "-rotate-45 -translate-y-1.5" : ""}`}
          />
        </div>
      </button>

      {/* Control Panel (slides up when open) */}
      <div
        className={`bg-background/95 dark:bg-background/95 rounded-xl shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-sm border border-border ${
          isOpen ? "max-h-96 p-4" : "max-h-0 p-0"
        }`}
      >
        <div className="min-w-[250px]">
          <h3 className="font-bold text-foreground mb-3 text-sm">
            Map Controls
          </h3>

          {/* Map Style Toggle */}
          <div className="mb-4">
            <div className="block text-xs font-medium text-muted-foreground mb-2">
              Map Style
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setMapStyle(MAP_STYLES.satellite)}
                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                  mapStyle === MAP_STYLES.satellite
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/25"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
              >
                🛰️ Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapStyle(MAP_STYLES.dark)}
                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                  mapStyle === MAP_STYLES.dark
                    ? "bg-gradient-to-r from-slate-600 to-slate-800 text-white border-slate-500 shadow-lg shadow-slate-500/25"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
              >
                🌙 Dark
              </button>
              <button
                type="button"
                onClick={() => setMapStyle(MAP_STYLES.outdoors)}
                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                  mapStyle === MAP_STYLES.outdoors
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/25"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                }`}
              >
                🏔️ Outdoors
              </button>
            </div>
          </div>

          {/* 2D/Globe Toggle */}
          <div className="mb-4">
            <div className="block text-xs font-medium text-slate-700 mb-2">
              View Mode
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setIsGlobe(false)}
                className={`px-4 py-2 text-xs rounded-lg border transition-all duration-200 ${
                  !isGlobe
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/25"
                    : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400"
                }`}
              >
                🗺️ 2D
              </button>
              <button
                type="button"
                onClick={() => setIsGlobe(true)}
                className={`px-4 py-2 text-xs rounded-lg border transition-all duration-200 ${
                  isGlobe
                    ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white border-violet-400 shadow-lg shadow-violet-500/25"
                    : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400"
                }`}
              >
                🌍 Globe
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-slate-600">
            <p className="mb-2 font-medium">
              {argoFloatsData.length} Argo floats in the Indian Ocean
            </p>
            <div className="flex items-center mb-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 shadow-sm"></div>
              <span>Active Float</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2 shadow-sm"></div>
              <span>Selected Float</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MAP_STYLES };
