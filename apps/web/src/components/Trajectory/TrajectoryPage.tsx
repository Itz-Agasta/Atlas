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
          err instanceof Error ? err.message : "Failed to load trajectory",
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
        <div className="w-[70%] p-6 overflow-y-auto border-r space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>

        {/* Map Skeleton - 30% */}
        <div className="w-[30%] relative">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex bg-background items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
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
      <div className="absolute inset-0 flex bg-background items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Trajectory Not Found</h2>
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
        <div className="w-[70%] p-6 overflow-y-auto border-r">
          <TrajectoryDashboard trajectory={trajectory} />
        </div>

        {/* Map - 30% */}
        <div className="w-[30%] relative">
          <TrajectoryMap trajectory={trajectory} />
        </div>
      </div>
    </>
  );
}
