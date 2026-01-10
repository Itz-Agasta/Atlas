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
    <div className="min-h-screen bg-background flex w-full">
      {/* Left Sidebar */}
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarContent>
          <FloatSidebar metadata={metadata} />
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${isAiSidebarOpen ? "mr-96" : ""}`}
      >
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Oceanographic Data Analysis
                </h1>
                <p className="text-sm text-muted-foreground">
                  Real-time data visualization and analysis platform
                </p>
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleAiSidebarToggle}
              >
                <MessageSquare className="h-4 w-4" />
                {isAiSidebarOpen ? "Hide" : "Ask"} AI Assistant
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Data Download Section */}
          <div className="max-w-7xl mx-auto">
            <DataDownload data={data} metadata={metadata} />
          </div>

          {/* Graphs Section */}
          <div className="max-w-7xl mx-auto">
            <Tabs defaultValue="profiles" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-11">
                <TabsTrigger value="profiles" className="text-sm">
                  Individual Profiles
                </TabsTrigger>
                <TabsTrigger value="ts-diagram" className="text-sm">
                  T-S Diagram
                </TabsTrigger>
                <TabsTrigger value="multi-param" className="text-sm">
                  Multi-Parameter
                </TabsTrigger>
                <TabsTrigger value="biogeochemical" className="text-sm">
                  Biogeochemical
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profiles" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  <OceanographicProfile
                    data={data}
                    parameter="temperature"
                    title="Sea Temperature"
                    unit="°C"
                    color="#dc2626"
                    width={350}
                    height={400}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="salinity"
                    title="Practical Salinity"
                    unit="PSU"
                    color="#2563eb"
                    width={350}
                    height={400}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="dissolvedOxygen"
                    title="Dissolved Oxygen"
                    unit="μmol/kg"
                    color="#059669"
                    width={350}
                    height={400}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="ph"
                    title="pH Profile"
                    unit="pH"
                    color="#7c3aed"
                    width={350}
                    height={400}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="nitrate"
                    title="Nitrate Profile"
                    unit="μmol/kg"
                    color="#ea580c"
                    width={350}
                    height={400}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="chlorophyll"
                    title="Chlorophyll-a"
                    unit="mg/m³"
                    color="#16a34a"
                    width={350}
                    height={400}
                  />
                </div>
              </TabsContent>

              <TabsContent value="ts-diagram" className="mt-6">
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
                        width={800}
                        height={600}
                      />
                    </CardContent>
                  </Card>

                  <AIInsights data={data} variant="ts-diagram" />
                </div>
              </TabsContent>

              <TabsContent value="multi-param" className="mt-6">
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
                        parameters={multiParameterConfig}
                        width={1000}
                        height={600}
                      />
                    </CardContent>
                  </Card>

                  <AIInsights data={data} variant="multi-parameter" />
                </div>
              </TabsContent>

              <TabsContent value="biogeochemical" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <OceanographicProfile
                    data={data}
                    parameter="chlorophyll"
                    title="Chlorophyll-a"
                    unit="mg/m³"
                    color="#16a34a"
                    width={400}
                    height={450}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="particleBackscattering"
                    title="Particle Backscattering"
                    unit="m⁻¹"
                    color="#dc2626"
                    width={400}
                    height={450}
                  />
                  <OceanographicProfile
                    data={data}
                    parameter="cdom"
                    title="CDOM"
                    unit="ppb"
                    color="#7c3aed"
                    width={400}
                    height={450}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* AI Assistant Sidebar */}
      {isAiSidebarOpen && (
        <div className="fixed right-0 top-0 h-screen w-96 bg-background border-l border-border shadow-lg z-50 flex flex-col">
          {/* AI Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              AI Assistant
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAiSidebarOpen(false)}
              className="h-8 w-8 p-0"
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
