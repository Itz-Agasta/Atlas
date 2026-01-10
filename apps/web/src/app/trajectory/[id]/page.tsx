import TrajectoryPage from "@/components/Trajectory/TrajectoryPage";
import "@/styles/trajectory-map.css";

interface TrajectoryRoutePageProps {
  params: Promise<{ id: string }>;
}

export default function TrajectoryRoutePage() {
  return (
    <div className="min-h-screen">
      <TrajectoryPage />
    </div>
  );
}

export async function generateMetadata({ params }: TrajectoryRoutePageProps) {
  const resolvedParams = await params;
  const floatId = resolvedParams.id;

  return {
    title: `Float ${floatId} Trajectory - Argo Float Tracker`,
    description: `View the trajectory path and measurement history for Argo float ${floatId}`,
  };
}
