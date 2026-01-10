"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Lightbulb,
  Loader2,
  TrendingUp,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { OceanographicData } from "@/data/mockOceanographicData";

interface AIInsightsProps {
  data: OceanographicData[];
  variant?: "ts-diagram" | "multi-parameter";
}

interface StepData {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
}

interface AnalysisResult {
  waterMasses: Array<{
    name: string;
    depthRange: string;
    characteristics: string;
    color: string;
  }>;
  correlations: Array<{
    parameters: string;
    correlation: number;
    strength: "Strong" | "Moderate" | "Weak";
    color: string;
  }>;
  biogeochemicalInsights: string[];
  keyFindings: string[];
}

const ANALYSIS_STEPS: StepData[] = [
  {
    id: 1,
    title: "Data Processing",
    description: "Analyzing oceanographic data patterns...",
    icon: BarChart3,
    duration: 1500,
  },
  {
    id: 2,
    title: "Water Mass Detection",
    description: "Identifying distinct water masses...",
    icon: Waves,
    duration: 2000,
  },
  {
    id: 3,
    title: "Parameter Correlation",
    description: "Computing statistical relationships...",
    icon: TrendingUp,
    duration: 1800,
  },
  {
    id: 4,
    title: "Generating Insights",
    description: "Synthesizing oceanographic findings...",
    icon: Brain,
    duration: 2200,
  },
];

export function AIInsights({ data, variant = "ts-diagram" }: AIInsightsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const generateAnalysisResults = (): AnalysisResult => {
    // Simulate AI analysis based on the data
    const maxDepth = Math.max(...data.map((d) => d.depth));
    const avgTemp =
      data.reduce((sum, d) => sum + d.temperature, 0) / data.length;

    return {
      waterMasses: [
        {
          name: "Surface Water",
          depthRange: "0-50m",
          characteristics: `High temperature (${avgTemp.toFixed(1)}°C avg), variable salinity`,
          color: "bg-blue-100 text-blue-800",
        },
        {
          name: "Thermocline Water",
          depthRange: "50-200m",
          characteristics: "Rapid temperature decline, stable salinity",
          color: "bg-green-100 text-green-800",
        },
        {
          name: "Intermediate Water",
          depthRange: "200-1000m",
          characteristics: "Gradual temperature decrease, oxygen minimum",
          color: "bg-purple-100 text-purple-800",
        },
        {
          name: "Deep Water",
          depthRange: `>1000m (max: ${maxDepth.toFixed(0)}m)`,
          characteristics: "Cold, stable, high salinity",
          color: "bg-gray-100 text-gray-800",
        },
      ],
      correlations: [
        {
          parameters: "Temperature ↔ Density",
          correlation: -0.89,
          strength: "Strong",
          color: "bg-red-100 text-red-800",
        },
        {
          parameters: "Depth ↔ Pressure",
          correlation: 0.99,
          strength: "Strong",
          color: "bg-blue-100 text-blue-800",
        },
        {
          parameters: "Temperature ↔ Dissolved O₂",
          correlation: 0.72,
          strength: "Strong",
          color: "bg-green-100 text-green-800",
        },
        {
          parameters: "Salinity ↔ CDOM",
          correlation: -0.54,
          strength: "Moderate",
          color: "bg-yellow-100 text-yellow-800",
        },
      ],
      biogeochemicalInsights: [
        `Chlorophyll maximum detected at ~${Math.floor(Math.random() * 40 + 60)}m (Deep Chlorophyll Maximum)`,
        `Oxygen minimum zone identified between ${Math.floor(Math.random() * 100 + 200)}-${Math.floor(Math.random() * 200 + 500)}m`,
        "Nitrate depletion in euphotic zone indicates active primary production",
        "pH variation strongly correlates with temperature profile",
        "CDOM levels suggest terrestrial influence in surface waters",
      ],
      keyFindings: [
        variant === "ts-diagram"
          ? "T-S relationship indicates presence of multiple water masses"
          : "Multi-parameter analysis reveals strong biogeochemical stratification",
        `Water column shows typical ${avgTemp > 20 ? "subtropical" : "temperate"} ocean characteristics`,
        "Strong thermocline detected between 50-150m depth",
        "Biogeochemical parameters suggest healthy marine ecosystem",
      ],
    };
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setCurrentStep(0);
    setProgress(0);
    setAnalysisComplete(false);

    // Simulate stepper progression
    for (let step = 0; step < ANALYSIS_STEPS.length; step++) {
      setCurrentStep(step);

      // Animate progress for current step
      const stepDuration = ANALYSIS_STEPS[step].duration;
      const progressIncrement = 100 / ANALYSIS_STEPS.length;
      const startProgress = step * progressIncrement;

      for (let i = 0; i <= 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, stepDuration / 20));
        setProgress(startProgress + (progressIncrement * i) / 20);
      }
    }

    // Generate and set results
    const analysisResults = generateAnalysisResults();
    setResults(analysisResults);
    setAnalysisComplete(true);
    setIsAnalyzing(false);
  };

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setCurrentStep(0);
    setProgress(0);
    setAnalysisComplete(false);
    setResults(null);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI-Generated Insights
          <Badge variant="secondary" className="ml-2">
            Powered by Float-Chat
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get instant analysis of{" "}
          {variant === "ts-diagram"
            ? "water mass characteristics and T-S relationships"
            : "multi-parameter correlations and biogeochemical patterns"}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {!isAnalyzing && !analysisComplete && (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground mb-4">
              Click below to start AI-powered analysis of the oceanographic data
            </p>
            <Button onClick={startAnalysis} className="gap-2">
              <Brain className="h-4 w-4" />
              Start Analysis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Analyzing Data...</h3>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === index;
                const isCompleted = currentStep > index;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-50 border border-blue-200"
                        : isCompleted
                          ? "bg-green-50 border border-green-200"
                          : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-full ${
                        isActive
                          ? "bg-blue-100"
                          : isCompleted
                            ? "bg-green-100"
                            : "bg-gray-100"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4
                        className={`font-medium ${
                          isActive
                            ? "text-blue-900"
                            : isCompleted
                              ? "text-green-900"
                              : "text-gray-700"
                        }`}
                      >
                        {step.title}
                      </h4>
                      <p
                        className={`text-sm ${
                          isActive
                            ? "text-blue-700"
                            : isCompleted
                              ? "text-green-700"
                              : "text-gray-600"
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {analysisComplete && results && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Analysis complete! Here are the AI-generated insights based on
                the oceanographic data.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6">
              {/* Water Mass Analysis */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-600" />
                  Water Mass Analysis
                </h3>
                <div className="grid gap-2">
                  {results.waterMasses.map((mass) => (
                    <div
                      key={`${mass.name}-${mass.depthRange}`}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={mass.color}>{mass.name}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {mass.depthRange}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {mass.characteristics}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parameter Correlations */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Parameter Correlations
                </h3>
                <div className="grid gap-2">
                  {results.correlations.map((corr) => (
                    <div
                      key={corr.parameters}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <span className="text-sm font-medium">
                        {corr.parameters}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge className={corr.color}>{corr.strength}</Badge>
                        <span className="text-sm font-mono">
                          r = {corr.correlation.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Biogeochemical Insights */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Biogeochemical Insights
                </h3>
                <ul className="space-y-2">
                  {results.biogeochemicalInsights.map((insight) => (
                    <li
                      key={insight}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="text-purple-500 mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Findings */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  Key Findings
                </h3>
                <ul className="space-y-2">
                  {results.keyFindings.map((finding) => (
                    <li
                      key={finding}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="text-yellow-500 mt-1">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={resetAnalysis}
                className="gap-2"
              >
                <Brain className="h-4 w-4" />
                Run New Analysis
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
