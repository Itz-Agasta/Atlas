"use client";

import { useParams } from "next/navigation";
import { FloatProfilePage } from "@/components/profile/FloatProfilePage";

export default function FloatPage() {
  const params = useParams();
  const floatId = params.id as string;

  return <FloatProfilePage floatId={floatId} />;
}
