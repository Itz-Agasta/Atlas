"use client";

import { useState } from "react";
import { Calendar, Waves, Ship, Wind, TrendingUp, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface HomeSidebarFilters {
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
}

interface NavigationSidebarProps {
  className?: string;
  onFiltersChange?: (filters: HomeSidebarFilters) => void;
}

interface FilterItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  key?: keyof HomeSidebarFilters["datasets"];
}

interface FilterSection {
  title: string;
  items: FilterItem[];
}

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
      { id: "argoCore", label: "Argo Core", icon: <Waves className="h-4 w-4" />, key: "argoCore" },
      { id: "argoBGC", label: "Argo BGC", icon: <Waves className="h-4 w-4" />, key: "argoBGC" },
      { id: "argoDeep", label: "Argo Deep", icon: <Waves className="h-4 w-4" />, key: "argoDeep" },
      { id: "woce", label: "WOCE", icon: <Ship className="h-4 w-4" />, key: "woce" },
      { id: "goShip", label: "GO-SHIP", icon: <Ship className="h-4 w-4" />, key: "goShip" },
      { id: "otherShips", label: "Other Ships", icon: <Ship className="h-4 w-4" />, key: "otherShips" },
      { id: "drifters", label: "Drifters", icon: <Wind className="h-4 w-4" />, key: "drifters" },
      { id: "tropicalCyclones", label: "Tropical Cyclones", icon: <Wind className="h-4 w-4" />, key: "tropicalCyclones" },
    ],
  },
  {
    title: "Deployment Period",
    items: [
      { id: "deploymentYears", label: "Deployment Years", icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
];

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

  const handleDatasetChange = (datasetKey: keyof HomeSidebarFilters["datasets"]) => {
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
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-4 z-[100] p-2 rounded-md transition-colors"
        style={{
          backgroundColor: "var(--sidebar)",
          color: "var(--sidebar-foreground)",
        }}
        aria-label="Open sidebar"
      >
        <PanelLeftOpen className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed left-0 top-0 h-full flex flex-col z-[100] overflow-hidden ${className || ""}`}
      style={{
        backgroundColor: "var(--sidebar)",
        width: "280px",
      }}
    >
      <div className="flex flex-col h-full w-full overflow-y-auto">
        {/* Header with Logo and Close Button */}
        <div className="px-4 pt-6 pb-2 flex items-start justify-between">
          <h1
            className="text-5xl font-bold tracking-tight font-sans"
            style={{ color: "var(--primary)" }}
          >
            Atlas
          </h1>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md hover:bg-[var(--sidebar-accent)] transition-colors"
            style={{ color: "var(--sidebar-foreground)" }}
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-6 space-y-8">
          {filterData.map((section) => (
            <div key={section.title}>
              {/* Section Header */}
              <h3
                className="text-xs font-medium mb-4 uppercase tracking-wide"
                style={{
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.05em",
                }}
              >
                {section.title}
              </h3>

              {/* Filter Items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.key
                    ? filters.datasets[item.key]
                    : item.id === "all"
                      ? filters.timePeriod === "all"
                      : false;

                  // Special handling for deployment years slider
                  if (item.id === "deploymentYears") {
                    const currentYear = new Date().getFullYear();
                    return (
                      <div key={item.id} className="space-y-3">
                        <div
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium"
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
                        <div className="px-3 space-y-2">
                          <div className="flex justify-between items-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                            <span>{filters.deploymentYears.start}</span>
                            <span>{filters.deploymentYears.end}</span>
                          </div>
                          <div className="px-1">
                            <Slider
                              value={[filters.deploymentYears.start, filters.deploymentYears.end]}
                              onValueChange={handleDeploymentYearsChange}
                              min={2000}
                              max={currentYear}
                              step={1}
                              className="w-full [&_[data-slot=slider-track]]:bg-primary-foreground"
                            />
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
                            <span>2000</span>
                            <span>{currentYear}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium"
                      style={{
                        backgroundColor: isActive ? "var(--sidebar-accent)" : "transparent",
                        borderRadius: "var(--radius)",
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span
                          style={{
                            color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {item.icon}
                        </span>
                        <span
                          style={{
                            color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleToggleClick(item, e)}
                        className="shrink-0 w-10 h-5 rounded-full transition-none focus:outline-none"
                        style={{
                          backgroundColor: isActive ? "var(--primary)" : "var(--primary-foreground)",
                          border: "1px solid",
                          borderColor: isActive ? "var(--primary)" : "var(--border)",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-none"
                          style={{
                            backgroundColor: isActive ? "var(--primary-foreground)" : "var(--primary)",
                            transform: isActive ? "translateX(20px)" : "translateX(0)",
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
