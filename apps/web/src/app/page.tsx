"use client";
import InteractiveArgoMap from "@/components/home/interactive-argo-map";
import { Sidebar } from "@/components/home/Sidebar";

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Layer */}
      <div className="fixed inset-0 z-10">
        <InteractiveArgoMap />
      </div>

      {/* Sidebar - high z-index to be above map */}
      <Sidebar className="z-100" />
    </div>
  );
}
