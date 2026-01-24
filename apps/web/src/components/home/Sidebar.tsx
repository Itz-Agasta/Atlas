"use client";

import { format } from "date-fns";
import {
  CalendarIcon,
  Droplets,
  Globe,
  Grid3X3,
  Lasso,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export interface SidebarFilters {
  platformId: string;
  timePeriod: string;
  customRange: { start: Date | undefined; end: Date | undefined };
  selectionTool: string;
  status: {
    all: boolean;
    active: boolean;
    inactive: boolean;
  };
  network: {
    bgcArgo: boolean;
    coreArgo: boolean;
    deepArgo: boolean;
  };
  overlays: {
    bathymetry: boolean;
    sst: boolean;
    salinityGradients: boolean;
  };
}

interface SidebarProps {
  className?: string;
  onFiltersChange?: (filters: SidebarFilters) => void;
}

const timePeriodOptions = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30 D" },
  { id: "5y", label: "5 y" },
  { id: "10y", label: "10 y" },
  { id: "all", label: "ALL" },
];

const statusOptions = [
  { id: "all", label: "ALL", count: 936 },
  { id: "active", label: "ACTIVE", count: 692 },
  { id: "inactive", label: "INACTIVE", count: 234 },
];

const networkOptions = [
  { id: "bgcArgo", label: "BGC ARGO", count: 1212 },
  { id: "coreArgo", label: "CORE ARGO", count: 692 },
  { id: "deepArgo", label: "DEEP ARGO", count: 234 },
];

const overlayOptions = [
  {
    id: "bathymetry",
    label: "Bathymetry",
    icon: <Mountain className="h-4 w-4" />,
  },
  { id: "sst", label: "SST", icon: <Waves className="h-4 w-4" /> },
  {
    id: "salinityGradients",
    label: "Salinity Gradients",
    icon: <Droplets className="h-4 w-4" />,
  },
];

export function Sidebar({ className, onFiltersChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<SidebarFilters>({
    platformId: "",
    timePeriod: "10y",
    customRange: { start: new Date(2020, 0, 1), end: new Date(2022, 0, 1) },
    selectionTool: "",
    status: {
      all: false,
      active: false,
      inactive: false,
    },
    network: {
      bgcArgo: false,
      coreArgo: false,
      deepArgo: false,
    },
    overlays: {
      bathymetry: true,
      sst: false,
      salinityGradients: true,
    },
  });

  const handleFilterUpdate = (newFilters: Partial<SidebarFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  };

  const handleTimePeriodChange = (period: string) => {
    handleFilterUpdate({ timePeriod: period });
  };

  const handleSelectionToolChange = (tool: string) => {
    handleFilterUpdate({
      selectionTool: filters.selectionTool === tool ? "" : tool,
    });
  };

  const handleStatusChange = (statusKey: keyof SidebarFilters["status"]) => {
    const updatedStatus = {
      ...filters.status,
      [statusKey]: !filters.status[statusKey],
    };
    handleFilterUpdate({ status: updatedStatus });
  };

  const handleNetworkChange = (networkKey: keyof SidebarFilters["network"]) => {
    const updatedNetwork = {
      ...filters.network,
      [networkKey]: !filters.network[networkKey],
    };
    handleFilterUpdate({ network: updatedNetwork });
  };

  const handleOverlayChange = (
    overlayKey: keyof SidebarFilters["overlays"]
  ) => {
    const updatedOverlays = {
      ...filters.overlays,
      [overlayKey]: !filters.overlays[overlayKey],
    };
    handleFilterUpdate({ overlays: updatedOverlays });
  };

  const getTimePeriodPosition = () => {
    const index = timePeriodOptions.findIndex(
      (opt) => opt.id === filters.timePeriod
    );
    return index >= 0 ? (index / (timePeriodOptions.length - 1)) * 100 : 75;
  };

  // When sidebar is closed, show the open button
  if (!isOpen) {
    return (
      <button
        aria-label="Open sidebar"
        className={`fixed top-4 left-4 z-[100] rounded-md p-1.5 transition-colors ${className || ""}`}
        onClick={() => setIsOpen(true)}
        style={{
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      >
        <PanelLeftOpen className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      className={`fixed top-4 left-4 z-[100] flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg ${className || ""}`}
      style={{
        backgroundColor: "var(--card)",
        width: "320px",
        border: "1px solid var(--border)",
      }}
    >
      {/* Close button */}
      <div className="flex items-center justify-end p-3 pb-0">
        <button
          aria-label="Close sidebar"
          className="rounded-md p-1.5 transition-colors hover:bg-[var(--accent)]"
          onClick={() => setIsOpen(false)}
          style={{ color: "var(--foreground)" }}
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-5 pt-2">
        {/* Platform ID Search */}
        <div className="mb-6">
          <h3
            className="mb-3 font-semibold text-xs uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            PLATFORM ID SEARCH
          </h3>
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <Search
              className="h-4 w-4"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              className="flex-1 bg-transparent text-sm outline-none"
              onChange={(e) =>
                handleFilterUpdate({ platformId: e.target.value })
              }
              placeholder="Enter Platform ID ..."
              style={{ color: "var(--foreground)" }}
              type="text"
              value={filters.platformId}
            />
          </div>
        </div>

        {/* Time Period */}
        <div className="mb-6">
          <h3
            className="mb-3 font-semibold text-xs uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            TIME PERIOD
          </h3>

          {/* Time Period Slider */}
          <div className="space-y-2">
            <div
              className="flex items-center justify-between text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              <span>{timePeriodOptions[0].label}</span>
              <span>
                {timePeriodOptions[timePeriodOptions.length - 1].label}
              </span>
            </div>
            <div className="px-1">
              <Slider
                className="w-full [&_[data-slot=slider-track]]:bg-muted"
                max={timePeriodOptions.length - 1}
                min={0}
                onValueChange={(values) =>
                  handleTimePeriodChange(timePeriodOptions[values[0]].id)
                }
                step={1}
                value={[
                  timePeriodOptions.findIndex(
                    (opt) => opt.id === filters.timePeriod
                  ),
                ]}
              />
            </div>
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {timePeriodOptions.map((option) => (
                <button
                  className={`transition-colors hover:opacity-80 ${
                    filters.timePeriod === option.id ? "font-semibold" : ""
                  }`}
                  key={option.id}
                  onClick={() => handleTimePeriodChange(option.id)}
                  style={{
                    color:
                      filters.timePeriod === option.id
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Range */}
          <div className="mb-2">
            <span
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              CUSTOM RANGE
            </span>
          </div>
          <div className="flex gap-3">
            {/* Start Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-left"
                  style={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="truncate text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Start:{" "}
                    {filters.customRange.start
                      ? format(filters.customRange.start, "MM/dd/yyyy")
                      : "Select"}
                  </span>
                  <CalendarIcon
                    className="ml-auto h-3 w-3"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="z-[200] w-auto p-0">
                <Calendar
                  initialFocus
                  mode="single"
                  onSelect={(date) =>
                    handleFilterUpdate({
                      customRange: { ...filters.customRange, start: date },
                    })
                  }
                  selected={filters.customRange.start}
                />
              </PopoverContent>
            </Popover>

            {/* End Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-left"
                  style={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="truncate text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    End:{" "}
                    {filters.customRange.end
                      ? format(filters.customRange.end, "MM/dd/yyyy")
                      : "Select"}
                  </span>
                  <CalendarIcon
                    className="ml-auto h-3 w-3"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="z-[200] w-auto p-0">
                <Calendar
                  initialFocus
                  mode="single"
                  onSelect={(date) =>
                    handleFilterUpdate({
                      customRange: { ...filters.customRange, end: date },
                    })
                  }
                  selected={filters.customRange.end}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Selection Tools */}
        <div className="mb-6">
          <h3
            className="mb-3 font-semibold text-xs uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            SELECTION TOOLS
          </h3>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center rounded-md p-3 transition-colors"
              onClick={() => handleSelectionToolChange("lasso")}
              style={{
                backgroundColor:
                  filters.selectionTool === "lasso"
                    ? "var(--accent)"
                    : "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Lasso className="h-5 w-5" />
            </button>
            <button
              className="flex flex-1 items-center justify-center rounded-md p-3 transition-colors"
              onClick={() => handleSelectionToolChange("grid")}
              style={{
                backgroundColor:
                  filters.selectionTool === "grid"
                    ? "var(--accent)"
                    : "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              className="flex flex-1 items-center justify-center rounded-md p-3 transition-colors"
              onClick={() => handleSelectionToolChange("globe")}
              style={{
                backgroundColor:
                  filters.selectionTool === "globe"
                    ? "var(--accent)"
                    : "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Globe className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div
          className="my-2 h-px w-full"
          style={{ backgroundColor: "var(--muted-foreground)", opacity: 0.3 }}
        />

        {/* Filtering */}
        <div className="mb-6">
          <h3
            className="mb-4 font-semibold text-xs uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            FILTERING
          </h3>

          {/* Status */}
          <div className="mb-4">
            <span
              className="mb-2 block font-medium text-xs"
              style={{ color: "var(--primary)" }}
            >
              Status
            </span>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <div
                  className="flex items-center justify-between"
                  key={option.id}
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-sm"
                      onClick={() =>
                        handleStatusChange(
                          option.id as keyof SidebarFilters["status"]
                        )
                      }
                      style={{
                        border: "1px solid var(--border)",
                        backgroundColor: filters.status[
                          option.id as keyof SidebarFilters["status"]
                        ]
                          ? "var(--primary)"
                          : "transparent",
                      }}
                    >
                      {filters.status[
                        option.id as keyof SidebarFilters["status"]
                      ] && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--primary-foreground)" }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {option.label}
                    </span>
                  </label>
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {option.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Network */}
          <div>
            <span
              className="mb-2 block font-medium text-xs"
              style={{ color: "var(--primary)" }}
            >
              Network
            </span>
            <div className="space-y-2">
              {networkOptions.map((option) => (
                <div
                  className="flex items-center justify-between"
                  key={option.id}
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-sm"
                      onClick={() =>
                        handleNetworkChange(
                          option.id as keyof SidebarFilters["network"]
                        )
                      }
                      style={{
                        border: "1px solid var(--border)",
                        backgroundColor: filters.network[
                          option.id as keyof SidebarFilters["network"]
                        ]
                          ? "var(--primary)"
                          : "transparent",
                      }}
                    >
                      {filters.network[
                        option.id as keyof SidebarFilters["network"]
                      ] && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--primary-foreground)" }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {option.label}
                    </span>
                  </label>
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {option.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mb-6 h-px"
          style={{ backgroundColor: "var(--border)" }}
        />

        {/* Overlays */}
        <div>
          <h3
            className="mb-4 font-semibold text-xs uppercase tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            OVERLAYS
          </h3>
          <div className="space-y-3">
            {overlayOptions.map((option) => (
              <div
                className="flex items-center justify-between"
                key={option.id}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--foreground)" }}>
                    {option.icon}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    {option.label}
                  </span>
                </div>
                <Switch
                  checked={
                    filters.overlays[
                      option.id as keyof SidebarFilters["overlays"]
                    ]
                  }
                  onCheckedChange={() =>
                    handleOverlayChange(
                      option.id as keyof SidebarFilters["overlays"]
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
