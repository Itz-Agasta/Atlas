"use client";

import { FaShip } from "react-icons/fa";
import { MdSailing, MdWaves } from "react-icons/md";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface DatasetFiltersProps {
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
  onDatasetsChange: (datasets: DatasetFiltersProps["datasets"]) => void;
}

interface FilterGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    key: keyof DatasetFiltersProps["datasets"];
    label: string;
    description: string;
    color?: string;
  }[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    title: "Argo Network",
    icon: MdWaves,
    items: [
      {
        key: "argoCore",
        label: "Argo Core",
        description: "Temperature and salinity profiles",
        color: "bg-blue-500",
      },
      {
        key: "argoBGC",
        label: "Argo BGC",
        description: "Biogeochemical measurements",
        color: "bg-green-500",
      },
      {
        key: "argoDeep",
        label: "Argo Deep",
        description: "Deep ocean profiles (>2000m)",
        color: "bg-purple-500",
      },
    ],
  },
  {
    title: "Ship-based Profiles",
    icon: FaShip,
    items: [
      {
        key: "woce",
        label: "WOCE",
        description: "World Ocean Circulation Experiment",
        color: "bg-orange-500",
      },
      {
        key: "goShip",
        label: "GO-SHIP",
        description: "Global Ocean Ship-based Observations",
        color: "bg-red-500",
      },
      {
        key: "otherShips",
        label: "Other Ships",
        description: "Additional ship-based measurements",
        color: "bg-gray-500",
      },
    ],
  },
  {
    title: "Surface & Atmospheric",
    icon: MdSailing,
    items: [
      {
        key: "drifters",
        label: "Global Drifters",
        description: "Surface drifting buoys",
        color: "bg-cyan-500",
      },
      {
        key: "tropicalCyclones",
        label: "Tropical Cyclones",
        description: "Hurricane/typhoon tracks and data",
        color: "bg-yellow-500",
      },
    ],
  },
];

export function DatasetFilters({
  datasets,
  onDatasetsChange,
}: DatasetFiltersProps) {
  const handleToggle = (key: keyof DatasetFiltersProps["datasets"]) => {
    onDatasetsChange({
      ...datasets,
      [key]: !datasets[key],
    });
  };

  const toggleGroup = (groupItems: FilterGroup["items"], enable: boolean) => {
    const updates = groupItems.reduce(
      (acc, item) => {
        acc[item.key] = enable;
        return acc;
      },
      {} as Partial<DatasetFiltersProps["datasets"]>,
    );

    onDatasetsChange({
      ...datasets,
      ...updates,
    });
  };

  const getGroupStatus = (groupItems: FilterGroup["items"]) => {
    const enabledCount = groupItems.filter((item) => datasets[item.key]).length;
    if (enabledCount === 0) return "none";
    if (enabledCount === groupItems.length) return "all";
    return "partial";
  };

  return (
    <div className="space-y-4">
      {FILTER_GROUPS.map((group) => {
        const groupStatus = getGroupStatus(group.items);
        const enabledCount = group.items.filter(
          (item) => datasets[item.key],
        ).length;

        return (
          <Card key={group.title} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <group.icon className="h-4 w-4 text-primary" />
                  {group.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {enabledCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-2 py-0">
                      {enabledCount}
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items, true)}
                      className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      disabled={groupStatus === "all"}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items, false)}
                      className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                      disabled={groupStatus === "none"}
                    >
                      None
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map((item, index) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${item.color || "bg-gray-400"}`}
                        title={`${item.label} indicator`}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={item.key}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {item.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={item.key}
                      checked={datasets[item.key]}
                      onCheckedChange={() => handleToggle(item.key)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  {index < group.items.length - 1 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() =>
            onDatasetsChange(
              Object.keys(datasets).reduce(
                (acc, key) => {
                  acc[key as keyof typeof datasets] = true;
                  return acc;
                },
                {} as typeof datasets,
              ),
            )
          }
          className="flex-1 text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Enable All
        </button>
        <button
          type="button"
          onClick={() =>
            onDatasetsChange(
              Object.keys(datasets).reduce(
                (acc, key) => {
                  acc[key as keyof typeof datasets] = false;
                  return acc;
                },
                {} as typeof datasets,
              ),
            )
          }
          className="flex-1 text-xs px-3 py-2 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Disable All
        </button>
      </div>
    </div>
  );
}
