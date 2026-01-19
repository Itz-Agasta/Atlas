"use client";

import {
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  Ship,
  TrendingUp,
  Waves,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";

// UI constants
const FONT_WEIGHT_ACTIVE = 600;
const FONT_WEIGHT_NORMAL = 400;

type HomeSidebarFilters = {
  timePeriod: string;
  customDateRange?: { start: Date; end: Date };
  datasets: {
    argoCore: boolean;
    argoBGC: boolean;
    argoDeep: boolean;
    woce: boolean;
    goShip: boolean;
    otherShips: boolean;
    drifters: boolean;
    tropicalCyclones: boolean;
  };
  deploymentYears: { start: number; end: number };
};

type NavigationSidebarProps = {
  className?: string;
  onFiltersChange?: (filters: HomeSidebarFilters) => void;
};

type FilterItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  key?: keyof HomeSidebarFilters["datasets"];
};

type FilterSection = {
  title: string;
  items: FilterItem[];
};

const filterData: FilterSection[] = [
  {
    title: "Time Period",
    items: [
      { id: "all", label: "All Time", icon: <Calendar className="h-4 w-4" /> },
    ],
  },
  {
    title: "Dataset Filters",
    items: [
      {
        id: "argoCore",
        label: "Argo Core",
        icon: <Waves className="h-4 w-4" />,
        key: "argoCore",
      },
      {
        id: "argoBGC",
        label: "Argo BGC",
        icon: <Waves className="h-4 w-4" />,
        key: "argoBGC",
      },
      {
        id: "argoDeep",
        label: "Argo Deep",
        icon: <Waves className="h-4 w-4" />,
        key: "argoDeep",
      },
      {
        id: "woce",
        label: "WOCE",
        icon: <Ship className="h-4 w-4" />,
        key: "woce",
      },
      {
        id: "goShip",
        label: "GO-SHIP",
        icon: <Ship className="h-4 w-4" />,
        key: "goShip",
      },
      {
        id: "otherShips",
        label: "Other Ships",
        icon: <Ship className="h-4 w-4" />,
        key: "otherShips",
      },
      {
        id: "drifters",
        label: "Drifters",
        icon: <Wind className="h-4 w-4" />,
        key: "drifters",
      },
      {
        id: "tropicalCyclones",
        label: "Tropical Cyclones",
        icon: <Wind className="h-4 w-4" />,
        key: "tropicalCyclones",
      },
    ],
  },
  {
    title: "Deployment Period",
    items: [
      {
        id: "deploymentYears",
        label: "Deployment Years",
        icon: <TrendingUp className="h-4 w-4" />,
      },
    ],
  },
];

// Helper component to render filter items
function FilterItemRenderer({
  item,
  filters,
  handleToggleClick,
  handleDeploymentYearsChange,
}: {
  item: FilterItem;
  filters: HomeSidebarFilters;
  handleToggleClick: (item: FilterItem, e: React.MouseEvent) => void;
  handleDeploymentYearsChange: (value: number[]) => void;
}) {
  let isActive = false;
  if (item.key) {
    isActive = filters.datasets[item.key];
  } else if (item.id === "all") {
    isActive = filters.timePeriod === "all";
  }

  // Special handling for deployment years slider
  if (item.id === "deploymentYears") {
    const currentYear = new Date().getFullYear();
    return (
      <div className="space-y-3" key={item.id}>
        <div
          className="flex w-full items-center gap-3 px-3 py-2 font-medium text-sm"
          style={{
            backgroundColor: "transparent",
            borderRadius: "var(--radius)",
          }}
        >
          <span
            style={{
              color: "var(--sidebar-foreground)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {item.icon}
          </span>
          <span
            style={{
              color: "var(--sidebar-foreground)",
              fontWeight: 400,
            }}
          >
            {item.label}
          </span>
        </div>
        <div className="space-y-2 px-3">
          <div
            className="flex items-center justify-between text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span>{filters.deploymentYears.start}</span>
            <span>{filters.deploymentYears.end}</span>
          </div>
          <div className="px-1">
            <Slider
              className="w-full [&_[data-slot=slider-track]]:bg-primary-foreground"
              max={currentYear}
              min={2000}
              onValueChange={handleDeploymentYearsChange}
              step={1}
              value={[
                filters.deploymentYears.start,
                filters.deploymentYears.end,
              ]}
            />
          </div>
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span>2000</span>
            <span>{currentYear}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center justify-between gap-3 px-3 py-2 font-medium text-sm"
      key={item.id}
      style={{
        backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="flex flex-1 items-center gap-3">
        <span
          style={{
            color: isActive
              ? "var(--sidebar-accent-foreground)"
              : "var(--sidebar-foreground)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {item.icon}
        </span>
        <span
          style={{
            color: isActive
              ? "var(--sidebar-accent-foreground)"
              : "var(--sidebar-foreground)",
            fontWeight: isActive ? FONT_WEIGHT_ACTIVE : FONT_WEIGHT_NORMAL,
          }}
        >
          {item.label}
        </span>
      </div>
      <button
        className="h-5 w-10 shrink-0 rounded-full transition-none focus:outline-none"
        onClick={(e) => handleToggleClick(item, e)}
        style={{
          backgroundColor: isActive
            ? "var(--primary)"
            : "var(--primary-foreground)",
          border: "1px solid",
          borderColor: isActive ? "var(--primary)" : "var(--border)",
          cursor: "pointer",
          position: "relative",
        }}
        type="button"
      >
        <span
          className="absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full transition-none"
          style={{
            backgroundColor: isActive
              ? "var(--primary-foreground)"
              : "var(--primary)",
            transform: isActive ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}

export function NavigationSidebar({
  className,
  onFiltersChange,
}: NavigationSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<HomeSidebarFilters>({
    timePeriod: "all",
    datasets: {
      argoCore: true,
      argoBGC: false,
      argoDeep: false,
      woce: false,
      goShip: false,
      otherShips: false,
      drifters: false,
      tropicalCyclones: false,
    },
    deploymentYears: { start: 2000, end: new Date().getFullYear() },
  });

  const handleFilterUpdate = (newFilters: Partial<HomeSidebarFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  };

  const handleTimePeriodChange = (timePeriod: string) => {
    handleFilterUpdate({ timePeriod });
  };

  const handleDatasetChange = (
    datasetKey: keyof HomeSidebarFilters["datasets"]
  ) => {
    const updatedDatasets = {
      ...filters.datasets,
      [datasetKey]: !filters.datasets[datasetKey],
    };
    handleFilterUpdate({ datasets: updatedDatasets });
  };

  const handleDeploymentYearsChange = (values: number[]) => {
    handleFilterUpdate({
      deploymentYears: { start: values[0], end: values[1] },
    });
  };

  const handleToggleClick = (item: FilterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.key) {
      handleDatasetChange(item.key);
    } else if (item.id === "all") {
      handleTimePeriodChange("all");
    }
  };

  // When sidebar is closed, show the open button
  if (!isOpen) {
    return (
      <button
        aria-label="Open sidebar"
        className="fixed top-4 left-4 z-[100] rounded-md p-2 transition-colors"
        onClick={() => setIsOpen(true)}
        style={{
          backgroundColor: "var(--sidebar)",
          color: "var(--sidebar-foreground)",
        }}
        type="button"
      >
        <PanelLeftOpen className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed top-0 left-0 z-[100] flex h-full flex-col overflow-hidden ${className || ""}`}
      style={{
        backgroundColor: "var(--sidebar)",
        width: "280px",
      }}
    >
      <div className="flex h-full w-full flex-col overflow-y-auto">
        {/* Header with Logo and Close Button */}
        <div className="flex items-start justify-between px-4 pt-6 pb-2">
          <h1
            className="font-bold font-sans text-2xl tracking-tight"
            style={{ color: "var(--primary-foreground)" }}
          >
            Atlas
          </h1>
          <button
            aria-label="Close sidebar"
            className="rounded-md p-1.5 transition-colors hover:bg-[var(--sidebar-accent)]"
            onClick={() => setIsOpen(false)}
            style={{ color: "var(--sidebar-foreground)" }}
            type="button"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 px-4 py-6">
          {filterData.map((section) => (
            <div key={section.title}>
              {/* Section Header */}
              <h3
                className="mb-4 font-medium text-xs uppercase tracking-wide"
                style={{
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.05em",
                }}
              >
                {section.title}
              </h3>

              {/* Filter Items */}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <FilterItemRenderer
                    filters={filters}
                    handleDeploymentYearsChange={handleDeploymentYearsChange}
                    handleToggleClick={handleToggleClick}
                    item={item}
                    key={item.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
