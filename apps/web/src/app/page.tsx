"use client";
import { useState, useEffect, useRef } from "react";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { NavigationSidebar } from "@/components/home/NavigationSidebar";
import WorldMapWithFloats from "@/components/ui/2d-map";
import MapLibre3DMap from "@/components/ui/3d-map";
import SatelliteMap from "@/components/ui/satellite-map";

type ViewMode = "2D" | "3D" | "SATELLITE";

export default function Home() {
  const [view, setView] = useState<ViewMode>("2D");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw starry background when in 3D mode
  useEffect(() => {
    if (view !== "3D") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawStars();
    };

    const drawStars = () => {
      if (!ctx) return;

      // Black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw random white stars
      const numStars = 200;
      for (let i = 0; i < numStars; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 1.5 + 0.5;
        const opacity = Math.random() * 0.8 + 0.2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [view]);

  const renderMap = () => {
    if (view === "3D") return <MapLibre3DMap setIs3D={() => {}} />;
    if (view === "SATELLITE") return <SatelliteMap />;
    return <WorldMapWithFloats setIs3D={() => {}} />;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Starry background - only visible in 3D mode */}
      {view === "3D" && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 z-0"
          style={{ backgroundColor: "#000000" }}
        />
      )}

      {/* Map Layer */}
      <div className="fixed inset-0 z-10">
        {renderMap()}
      </div>

      {/* Navigation Sidebar - high z-index to be above map */}
      <NavigationSidebar className="z-[100]" />

      {/* Floating Dock Navbar - high z-index to be above map */}
      <HomeNavbar />

      {/* View Switcher - fixed overlay, bottom left corner */}
      <div className="fixed bottom-3 left-3 z-[100]">
        <div className="flex items-center overflow-hidden rounded-md border shadow" style={{ backgroundColor: "#1b1b1a" }}>
          {(["2D", "3D", "SATELLITE"] as const).map((m) => {
            const active = view === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setView(m)}
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
    </div>
  );
}
