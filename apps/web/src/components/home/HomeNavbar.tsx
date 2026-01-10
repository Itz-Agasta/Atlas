
"use client";
import {
  Database,
  TrendingUp,
  MapPin,
  Users,
  FileText,
} from "lucide-react";
import { FloatingNav } from "@/components/ui/floating-navbar";

const navItems = [
  {
    name: "Ocean Data",
    link: "/profiles",
    icon: <Database className="h-4 w-4" />,
  },
  {
    name: "Analysis Tools",
    link: "/tools/statistics",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    name: "Live Floats",
    link: "/",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    name: "Research",
    link: "/research",
    icon: <Users className="h-4 w-4" />,
  },
  {
    name: "Documentation",
    link: "/documentation",
    icon: <FileText className="h-4 w-4" />,
  },
];

export function HomeNavbar() {
  return <FloatingNav navItems={navItems} className="top-8" />;
}
