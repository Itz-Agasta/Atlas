"use client";

import type { FloatLocationsResponse } from "@atlas/schema/api/home-page";
import { useCallback, useEffect, useState } from "react";
import InteractiveArgoMap from "@/components/home/interactive-argo-map";
import { Sidebar, type SidebarFilters } from "@/components/home/Sidebar";
import { fetchFloatLocations } from "@/lib/utils";

export default function MapWithFilters() {
  const [floatLocations, setFloatLocations] = useState<
    FloatLocationsResponse["data"]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SidebarFilters | null>(null);

  // Fetch float locations on mount
  useEffect(() => {
    async function loadFloatLocations() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchFloatLocations();
        if (response.success) {
          setFloatLocations(response.data);
        } else {
          setError("Failed to load float locations");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    loadFloatLocations();
  }, []);

  // Handle filter changes from sidebar
  const handleFiltersChange = useCallback((newFilters: SidebarFilters) => {
    setFilters(newFilters);
  }, []);

  // Apply filters to float locations
  const filteredLocations = floatLocations.filter((float) => {
    if (!filters) {
      return true;
    }

    // Filter by platform ID search
    if (
      filters.platformId &&
      !String(float.floatId).includes(filters.platformId)
    ) {
      return false;
    }

    // Filter by status
    const hasStatusFilter =
      filters.status.active || filters.status.inactive || filters.status.all;
    if (hasStatusFilter && !filters.status.all) {
      const floatStatus = float.status?.toUpperCase();
      if (
        filters.status.active &&
        floatStatus !== "ACTIVE" &&
        !filters.status.inactive
      ) {
        return false;
      }
      if (
        filters.status.inactive &&
        floatStatus !== "INACTIVE" &&
        !filters.status.active
      ) {
        return false;
      }
      // If both active and inactive are selected, show both
      if (
        filters.status.active &&
        filters.status.inactive &&
        floatStatus !== "ACTIVE" &&
        floatStatus !== "INACTIVE"
      ) {
        return false;
      }
    }

    // Filter by network (floatType)
    const hasNetworkFilter =
      filters.network.bgcArgo ||
      filters.network.coreArgo ||
      filters.network.deepArgo;
    if (hasNetworkFilter) {
      const floatType = float.floatType?.toLowerCase();
      const matchesBgc =
        filters.network.bgcArgo && floatType === "biogeochemical";
      const matchesCore = filters.network.coreArgo && floatType === "core";
      const matchesDeep = filters.network.deepArgo && floatType === "deep";

      if (!(matchesBgc || matchesCore || matchesDeep)) {
        return false;
      }
    }

    // Filter by time period
    if (
      float.lastUpdate &&
      filters.customRange.start &&
      filters.customRange.end
    ) {
      const floatDate = new Date(float.lastUpdate);
      if (
        floatDate < filters.customRange.start ||
        floatDate > filters.customRange.end
      ) {
        return false;
      }
    }

    // Apply time period preset filters
    if (filters.timePeriod !== "all" && float.lastUpdate) {
      const floatDate = new Date(float.lastUpdate);
      const now = new Date();
      let cutoffDate: Date;

      switch (filters.timePeriod) {
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "5y":
          cutoffDate = new Date(
            now.getFullYear() - 5,
            now.getMonth(),
            now.getDate()
          );
          break;
        case "10y":
          cutoffDate = new Date(
            now.getFullYear() - 10,
            now.getMonth(),
            now.getDate()
          );
          break;
        default:
          cutoffDate = new Date(0); // All time
      }

      if (floatDate < cutoffDate) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Layer */}
      <div className="fixed inset-0 z-10">
        <InteractiveArgoMap
          error={error}
          floatLocations={filteredLocations}
          isLoading={isLoading}
        />
      </div>

      {/* Sidebar - high z-index to be above map */}
      <Sidebar className="z-100" onFiltersChange={handleFiltersChange} />
    </div>
  );
}
