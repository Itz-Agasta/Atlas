"use client";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import InteractiveArgoMap from "@/components/home/InteractiveArgoMap";
import { NavigationSidebar } from "@/components/home/NavigationSidebar";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Layer */}
      <div className="fixed inset-0 z-10">
        <InteractiveArgoMap />
      </div>

      {/* Navigation Sidebar - high z-index to be above map */}
      <NavigationSidebar className="z-100" />

      {/* Floating Dock Navbar - high z-index to be above map */}
      <HomeNavbar />
    </div>
  );
}
