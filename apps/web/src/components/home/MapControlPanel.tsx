"use client";

import { Satellite, Moon, Mountain, Map, Globe, Settings } from "lucide-react";

// Map style options
const MAP_STYLES = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
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
  floatCount: number;
}

export default function MapControlPanel({
  mapStyle,
  setMapStyle,
  isGlobe,
  setIsGlobe,
  isOpen,
  setIsOpen,
  floatCount,
}: MapControlPanelProps) {
  return (
    <div className="fixed bottom-4 right-4 z-10 flex flex-col items-end">
      {/* Control Panel (slides up when open) */}
      {isOpen && (
        <div
          className="mb-2 rounded-lg p-4 backdrop-blur-sm"
          style={{
            backgroundColor: "var(--sidebar)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="min-w-[240px]">
            <h3
              className="font-semibold mb-4 text-sm uppercase tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              Map Controls
            </h3>

            {/* Map Style Toggle */}
            <div className="mb-5">
              <div
                className="text-xs font-medium mb-2 uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Map Style
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMapStyle(MAP_STYLES.satellite)}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-xs rounded-md transition-all duration-200"
                  style={{
                    backgroundColor:
                      mapStyle === MAP_STYLES.satellite
                        ? "var(--sidebar-accent)"
                        : "transparent",
                    color:
                      mapStyle === MAP_STYLES.satellite
                        ? "var(--sidebar-accent-foreground)"
                        : "var(--sidebar-foreground)",
                    border: "1px solid",
                    borderColor:
                      mapStyle === MAP_STYLES.satellite
                        ? "var(--primary)"
                        : "var(--border)",
                  }}
                >
                  <Satellite className="h-4 w-4" />
                  <span>Satellite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle(MAP_STYLES.dark)}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-xs rounded-md transition-all duration-200"
                  style={{
                    backgroundColor:
                      mapStyle === MAP_STYLES.dark
                        ? "var(--sidebar-accent)"
                        : "transparent",
                    color:
                      mapStyle === MAP_STYLES.dark
                        ? "var(--sidebar-accent-foreground)"
                        : "var(--sidebar-foreground)",
                    border: "1px solid",
                    borderColor:
                      mapStyle === MAP_STYLES.dark
                        ? "var(--primary)"
                        : "var(--border)",
                  }}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle(MAP_STYLES.outdoors)}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-xs rounded-md transition-all duration-200"
                  style={{
                    backgroundColor:
                      mapStyle === MAP_STYLES.outdoors
                        ? "var(--sidebar-accent)"
                        : "transparent",
                    color:
                      mapStyle === MAP_STYLES.outdoors
                        ? "var(--sidebar-accent-foreground)"
                        : "var(--sidebar-foreground)",
                    border: "1px solid",
                    borderColor:
                      mapStyle === MAP_STYLES.outdoors
                        ? "var(--primary)"
                        : "var(--border)",
                  }}
                >
                  <Mountain className="h-4 w-4" />
                  <span>Outdoors</span>
                </button>
              </div>
            </div>

            {/* 2D/Globe Toggle */}
            <div className="mb-5">
              <div
                className="text-xs font-medium mb-2 uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                View Mode
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsGlobe(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-md transition-all duration-200"
                  style={{
                    backgroundColor: !isGlobe
                      ? "var(--sidebar-accent)"
                      : "transparent",
                    color: !isGlobe
                      ? "var(--sidebar-accent-foreground)"
                      : "var(--sidebar-foreground)",
                    border: "1px solid",
                    borderColor: !isGlobe ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <Map className="h-4 w-4" />
                  <span>2D</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGlobe(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-md transition-all duration-200"
                  style={{
                    backgroundColor: isGlobe
                      ? "var(--sidebar-accent)"
                      : "transparent",
                    color: isGlobe
                      ? "var(--sidebar-accent-foreground)"
                      : "var(--sidebar-foreground)",
                    border: "1px solid",
                    borderColor: isGlobe ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <Globe className="h-4 w-4" />
                  <span>Globe</span>
                </button>
              </div>
            </div>

            {/* Info */}
            <div
              className="text-xs pt-3"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              }}
            >
              <p className="mb-2 font-medium">
                {floatCount} Argo floats in the Indian Ocean
              </p>
              <div className="flex items-center mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-full mr-2"
                  style={{ backgroundColor: "var(--primary)" }}
                />
                <span>Active Float</span>
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-2" />
                <span>Selected Float</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-lg transition-all duration-200 backdrop-blur-sm"
        style={{
          backgroundColor: isOpen ? "var(--sidebar-accent)" : "var(--sidebar)",
          color: isOpen
            ? "var(--sidebar-accent-foreground)"
            : "var(--sidebar-foreground)",
          border: "1px solid var(--border)",
        }}
        aria-label="Toggle map controls"
      >
        <Settings
          className={`h-5 w-5 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>
    </div>
  );
}

export { MAP_STYLES };
