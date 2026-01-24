"use client";

import { MessageSquare, X } from "lucide-react";
import { useMemo, useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import { AIInsights } from "@/components/profile/AIInsights";
import { DataDownload } from "@/components/profile/DataDownload";
import { FloatSidebar } from "@/components/profile/FloatSidebar";
import { MultiParameterProfile } from "@/components/profile/graphs/MultiParameterProfile";
import { OceanographicProfile } from "@/components/profile/graphs/OceanographicProfile";
import { TemperatureSalinityDiagram } from "@/components/profile/graphs/TemperatureSalinityDiagram";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type FloatMetadata,
  generateDepthLevels,
  generateMockOceanographicData,
  getMockFloatMetadata,
} from "@/data/mockOceanographicData";

interface FloatProfilePageProps {
  floatId: string;
}

interface MultiParameterConfig {
  key: "temperature" | "salinity" | "dissolvedOxygen" | "chlorophyll";
  name: string;
  color: string;
  unit: string;
}

export function FloatProfilePage({ floatId }: FloatProfilePageProps) {
  // Generate consistent mock data for this float
  const { data, metadata } = useMemo(() => {
    const depths = generateDepthLevels();
    const oceanData = generateMockOceanographicData(depths);
    const floatMetadata = getMockFloatMetadata(floatId);

    return {
      data: oceanData,
      metadata: floatMetadata,
    };
  }, [floatId]);

  const multiParameterConfig: MultiParameterConfig[] = [
    {
      key: "temperature",
      name: "Temperature",
      color: "#dc2626",
      unit: "°C",
    },
    {
      key: "salinity",
      name: "Salinity",
      color: "#2563eb",
      unit: "PSU",
    },
    {
      key: "dissolvedOxygen",
      name: "Dissolved O₂",
      color: "#059669",
      unit: "μmol/kg",
    },
    {
      key: "chlorophyll",
      name: "Chlorophyll-a",
      color: "#d97706",
      unit: "mg/m³",
    },
  ];

  return (
    <SidebarProvider>
      <FloatProfileContent
        data={data}
        metadata={metadata}
        multiParameterConfig={multiParameterConfig}
      />
    </SidebarProvider>
  );
}

function FloatProfileContent({
  data,
  metadata,
  multiParameterConfig,
}: {
  data: ReturnType<typeof generateMockOceanographicData>;
  metadata: FloatMetadata;
  multiParameterConfig: MultiParameterConfig[];
}) {
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const { setOpen } = useSidebar();

  // Function to handle AI sidebar toggle and close left sidebar
  const handleAiSidebarToggle = () => {
    const newAiSidebarState = !isAiSidebarOpen;
    setIsAiSidebarOpen(newAiSidebarState);

    // Close left sidebar when AI sidebar opens
    if (newAiSidebarState) {
      setOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left Sidebar */}
      <Sidebar>
        <SidebarContent>
          <FloatSidebar metadata={metadata} />
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${isAiSidebarOpen ? "mr-96" : ""}`}
      >
        {/* Header */}
        <header className="border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="font-semibold text-foreground text-xl">
                  Oceanographic Data Analysis
                </h1>
                <p className="text-muted-foreground text-sm">
                  Real-time data visualization and analysis platform
                </p>
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                className="gap-2"
                onClick={handleAiSidebarToggle}
                size="sm"
                variant="outline"
              >
                <MessageSquare className="h-4 w-4" />
                {isAiSidebarOpen ? "Hide" : "Ask"} AI Assistant
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6 overflow-auto p-6">
          {/* Data Download Section */}
          <div className="mx-auto max-w-7xl">
            <DataDownload data={data} metadata={metadata} />
          </div>

          {/* Graphs Section */}
          <div className="mx-auto max-w-7xl">
            <Tabs className="w-full" defaultValue="profiles">
              <TabsList className="grid h-11 w-full grid-cols-4">
                <TabsTrigger className="text-sm" value="profiles">
                  Individual Profiles
                </TabsTrigger>
                <TabsTrigger className="text-sm" value="ts-diagram">
                  T-S Diagram
                </TabsTrigger>
                <TabsTrigger className="text-sm" value="multi-param">
                  Multi-Parameter
                </TabsTrigger>
                <TabsTrigger className="text-sm" value="biogeochemical">
                  Biogeochemical
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-6" value="profiles">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <OceanographicProfile
                    color="#dc2626"
                    data={data}
                    height={400}
                    parameter="temperature"
                    title="Sea Temperature"
                    unit="°C"
                    width={350}
                  />
                  <OceanographicProfile
                    color="#2563eb"
                    data={data}
                    height={400}
                    parameter="salinity"
                    title="Practical Salinity"
                    unit="PSU"
                    width={350}
                  />
                  <OceanographicProfile
                    color="#059669"
                    data={data}
                    height={400}
                    parameter="dissolvedOxygen"
                    title="Dissolved Oxygen"
                    unit="μmol/kg"
                    width={350}
                  />
                  <OceanographicProfile
                    color="#7c3aed"
                    data={data}
                    height={400}
                    parameter="ph"
                    title="pH Profile"
                    unit="pH"
                    width={350}
                  />
                  <OceanographicProfile
                    color="#ea580c"
                    data={data}
                    height={400}
                    parameter="nitrate"
                    title="Nitrate Profile"
                    unit="μmol/kg"
                    width={350}
                  />
                  <OceanographicProfile
                    color="#16a34a"
                    data={data}
                    height={400}
                    parameter="chlorophyll"
                    title="Chlorophyll-a"
                    unit="mg/m³"
                    width={350}
                  />
                </div>
              </TabsContent>

              <TabsContent className="mt-6" value="ts-diagram">
                <div className="space-y-6">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="text-xl">
                        Temperature-Salinity Diagram
                      </CardTitle>
                      <p className="text-muted-foreground">
                        Visualizing water mass characteristics through T-S
                        relationship
                      </p>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <TemperatureSalinityDiagram
                        data={data}
                        height={600}
                        width={800}
                      />
                    </CardContent>
                  </Card>

                  <AIInsights data={data} variant="ts-diagram" />
                </div>
              </TabsContent>

              <TabsContent className="mt-6" value="multi-param">
                <div className="space-y-6">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle className="text-xl">
                        Multi-Parameter Profile
                      </CardTitle>
                      <p className="text-muted-foreground">
                        Simultaneous visualization of multiple oceanographic
                        parameters
                      </p>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                      <MultiParameterProfile
                        data={data}
                        height={600}
                        parameters={multiParameterConfig}
                        width={1000}
                      />
                    </CardContent>
                  </Card>

                  <AIInsights data={data} variant="multi-parameter" />
                </div>
              </TabsContent>

              <TabsContent className="mt-6" value="biogeochemical">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  <OceanographicProfile
                    color="#16a34a"
                    data={data}
                    height={450}
                    parameter="chlorophyll"
                    title="Chlorophyll-a"
                    unit="mg/m³"
                    width={400}
                  />
                  <OceanographicProfile
                    color="#dc2626"
                    data={data}
                    height={450}
                    parameter="particleBackscattering"
                    title="Particle Backscattering"
                    unit="m⁻¹"
                    width={400}
                  />
                  <OceanographicProfile
                    color="#7c3aed"
                    data={data}
                    height={450}
                    parameter="cdom"
                    title="CDOM"
                    unit="ppb"
                    width={400}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* AI Assistant Sidebar */}
      {isAiSidebarOpen && (
        <div className="fixed top-0 right-0 z-50 flex h-screen w-96 flex-col border-border border-l bg-background shadow-lg">
          {/* AI Sidebar Header */}
          <div className="flex items-center justify-between border-border border-b p-4">
            <h2 className="font-semibold text-foreground text-lg">
              AI Assistant
            </h2>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => setIsAiSidebarOpen(false)}
              size="sm"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* AI Chat Interface */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface />
          </div>
        </div>
      )}
    </div>
  );
}
