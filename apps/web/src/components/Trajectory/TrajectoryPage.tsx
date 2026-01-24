"use client";

import { AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TrajectoryDashboard from "@/components/Trajectory/TrajectoryDashboard";
import TrajectoryMap from "@/components/Trajectory/TrajectoryMap";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FloatTrajectory } from "@/data/mockTrajectoryData";
import { getTrajectoryData } from "@/data/mockTrajectoryData";

export default function TrajectoryPage() {
  const params = useParams();
  const [trajectory, setTrajectory] = useState<FloatTrajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrajectory() {
      try {
        setLoading(true);
        setError(null);

        const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
        if (!id) {
          throw new Error("No trajectory ID provided");
        }

        const trajectoryData = getTrajectoryData(id);
        if (!trajectoryData) {
          throw new Error(`Trajectory with ID ${id} not found`);
        }

        setTrajectory(trajectoryData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trajectory"
        );
      } finally {
        setLoading(false);
      }
    }

    loadTrajectory();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex bg-background">
        {/* Dashboard Skeleton - 70% */}
        <div className="w-[70%] space-y-6 overflow-y-auto border-r p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-8 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-8 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-8 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-8 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>

        {/* Map Skeleton - 30% */}
        <div className="relative w-[30%]">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-2 font-semibold text-xl">
              Error Loading Trajectory
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trajectory) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h2 className="mb-2 font-semibold text-xl">Trajectory Not Found</h2>
            <p className="text-muted-foreground">
              The requested trajectory could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Use absolute positioning to override the SidebarProvider flex layout */}
      <div className="absolute inset-0 flex bg-background">
        {/* Dashboard - 70% */}
        <div className="w-[70%] overflow-y-auto border-r p-6">
          <TrajectoryDashboard trajectory={trajectory} />
        </div>

        {/* Map - 30% */}
        <div className="relative w-[30%]">
          <TrajectoryMap trajectory={trajectory} />
        </div>
      </div>
    </>
  );
}
