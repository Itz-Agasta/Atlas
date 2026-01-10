"use client";
import { useState } from "react";
import Chat from "@/components/Chat";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { NavigationSidebar } from "@/components/home/NavigationSidebar";
import WorldMapWithFloats from "@/components/ui/2d-map";
import MapLibre3DMap from "@/components/ui/3d-map";
import SatelliteMap from "@/components/ui/satellite-map";
import { IconMenu2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type ViewMode = "2D" | "3D" | "SATELLITE";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [is3D, setIs3DState] = useState(false);
  const [view, setView] = useState<ViewMode>("2D");
  // Filter state for the sidebar (currently for future use when connecting with map filters)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filters, setFilters] = useState<HomeSidebarFilters>({
    timePeriod: "all",
    datasets: {
      argoCore: true,
      argoBGC: true,
      argoDeep: false,
      woce: false,
      goShip: false,
      otherShips: false,
      drifters: false,
      tropicalCyclones: false,
    },
    deploymentYears: { start: 2000, end: new Date().getFullYear() },
  });

  const handleOpenChat = () => {
    setIsChatVisible(true);
  };

  const handleFiltersChange = (newFilters: HomeSidebarFilters) => {
    setFilters(newFilters);
    // Here you can add logic to update your map or data based on filters
    console.log("Filters updated:", newFilters);
  };

  // Wrap setIs3D to keep existing child controls working while syncing view mode
  const setIs3D: React.Dispatch<React.SetStateAction<boolean>> = (next) => {
    const nextVal = typeof next === "function" ? (next as (prev: boolean) => boolean)(is3D) : next;
    setIs3DState(nextVal);
    setView(nextVal ? "3D" : "2D");
  };

  const renderMap = () => {
    if (view === "3D") return <MapLibre3DMap setIs3D={setIs3D} />;
    if (view === "SATELLITE") return <SatelliteMap />;
    return <WorldMapWithFloats setIs3D={setIs3D} />;
  };

  return (
    <>
      {/* Sidebar */}
      <NavigationSidebar />

      {/* Main Content */}
      <div className="flex flex-col min-h-screen">
        {/* Sidebar Trigger - Top Left (only when sidebar is closed) */}
        {!sidebarOpen && (
          <div className="fixed top-3 left-3 z-[60]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-7 w-7"
              style={{ backgroundColor: "#1b1b1a", color: "#999998", zIndex: 60 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#303130";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1b1b1a";
              }}
            >
              <IconMenu2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Navigation Bar (floating overlay) */}

        <div className="flex-1 h-full flex items-center">
          <HomeNavbar />
        </div>

        {/* View Switcher - fixed overlay, bottom left corner */}
        <div className="fixed bottom-3 left-3 z-50">
          <div className="flex items-center overflow-hidden rounded-md border shadow" style={{ backgroundColor: "#1b1b1a" }}>
            {(["2D", "3D", "SATELLITE"] as const).map((m) => {
              const active = view === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setView(m);
                    if (m === "3D") setIs3DState(true);
                    else setIs3DState(false);
                  }}
                  className="px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{
                    color: "#999998",
                    backgroundColor: active ? "#303130" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "#303130";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  {m === "SATELLITE" ? "Satellite" : m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Layer: fixed and centered behind overlays */}
        <div className="fixed inset-0 z-0">
          {renderMap()}
        </div>

        {/* Chat Interface */}
        {isChatVisible && <Chat onClose={() => setIsChatVisible(false)} />}
      </div>
    </>
  );
}
