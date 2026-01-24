"use client";

import { Globe, Map, Moon, Mountain, Satellite, Settings } from "lucide-react";

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
    <div className="fixed right-4 bottom-4 z-10 flex flex-col items-end">
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
              className="mb-4 font-semibold text-sm uppercase tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              Map Controls
            </h3>

            {/* Map Style Toggle */}
            <div className="mb-5">
              <div
                className="mb-2 font-medium text-xs uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Map Style
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="flex flex-col items-center gap-1.5 rounded-md px-3 py-2.5 text-xs transition-all duration-200"
                  onClick={() => setMapStyle(MAP_STYLES.satellite)}
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
                  type="button"
                >
                  <Satellite className="h-4 w-4" />
                  <span>Satellite</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1.5 rounded-md px-3 py-2.5 text-xs transition-all duration-200"
                  onClick={() => setMapStyle(MAP_STYLES.dark)}
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
                  type="button"
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1.5 rounded-md px-3 py-2.5 text-xs transition-all duration-200"
                  onClick={() => setMapStyle(MAP_STYLES.outdoors)}
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
                  type="button"
                >
                  <Mountain className="h-4 w-4" />
                  <span>Outdoors</span>
                </button>
              </div>
            </div>

            {/* 2D/Globe Toggle */}
            <div className="mb-5">
              <div
                className="mb-2 font-medium text-xs uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                View Mode
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs transition-all duration-200"
                  onClick={() => setIsGlobe(false)}
                  style={{
                    backgroundColor: isGlobe
                      ? "transparent"
                      : "var(--sidebar-accent)",
                    color: isGlobe
                      ? "var(--sidebar-foreground)"
                      : "var(--sidebar-accent-foreground)",
                    border: "1px solid",
                    borderColor: isGlobe ? "var(--border)" : "var(--primary)",
                  }}
                  type="button"
                >
                  <Map className="h-4 w-4" />
                  <span>2D</span>
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs transition-all duration-200"
                  onClick={() => setIsGlobe(true)}
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
                  type="button"
                >
                  <Globe className="h-4 w-4" />
                  <span>Globe</span>
                </button>
              </div>
            </div>

            {/* Info */}
            <div
              className="pt-3 text-xs"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              }}
            >
              <p className="mb-2 font-medium">
                {floatCount} Argo floats in the Indian Ocean
              </p>
              <div className="mb-1 flex items-center">
                <div
                  className="mr-2 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--primary)" }}
                />
                <span>Active Float</span>
              </div>
              <div className="flex items-center">
                <div className="mr-2 h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <span>Selected Float</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button */}
      <button
        aria-label="Toggle map controls"
        className="rounded-lg p-3 backdrop-blur-sm transition-all duration-200"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: isOpen ? "var(--sidebar-accent)" : "var(--sidebar)",
          color: isOpen
            ? "var(--sidebar-accent-foreground)"
            : "var(--sidebar-foreground)",
          border: "1px solid var(--border)",
        }}
        type="button"
      >
        <Settings
          className={`h-5 w-5 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
        />
      </button>
    </div>
  );
}

export { MAP_STYLES };
