"use client";
import {
  IconChartLine,
  IconDatabase,
  IconFileText,
  IconMapPin,
  IconUsers,
} from "@tabler/icons-react";
import { FloatingDock } from "@/components/ui/floating-dock";

const navItems = [
  {
    title: "Ocean Data",
    href: "/profiles",
    icon: (
      <IconDatabase className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Analysis Tools",
    href: "/tools/statistics",
    icon: (
      <IconChartLine className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Live Floats",
    href: "/",
    icon: (
      <IconMapPin className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Research",
    href: "/research",
    icon: (
      <IconUsers className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Documentation",
    href: "/documentation",
    icon: (
      <IconFileText className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
];

export default function DockNavigation() {
  return (
    <div className="-translate-x-1/2 fixed bottom-8 left-1/2 z-100">
      <FloatingDock items={navItems} />
    </div>
  );
}
