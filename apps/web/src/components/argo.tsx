"use client";

/** This is the file for old argo map using 2d static image
 * This is deprecated now
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamically import Plot to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded bg-gray-200" />
  ),
});

type ArgoVisualizerProps = {
  onClose?: () => void;
  closed?: boolean;
};

export default function ArgoVisualizer({ onClose }: ArgoVisualizerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render on server
  if (!isClient) {
    return (
      <div className="relative min-w-[320px] max-w-[380px] rounded-xl bg-white/95 p-3 shadow-lg">
        <div className="animate-pulse">
          <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-64 rounded bg-gray-200" />
        </div>
      </div>
    );
  }
  const depth = [
    0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750,
    800, 850, 900, 950,
  ];
  const temp = [
    25, 24.8, 24.5, 24.2, 23.9, 23.5, 23.1, 22.7, 22.3, 21.9, 21.5, 21.1, 20.7,
    20.3, 19.9, 19.5, 19.1, 18.7, 18.3, 17.9,
  ];
  const sal = [
    34, 34.01, 34.02, 34.03, 34.04, 34.05, 34.06, 34.07, 34.08, 34.09, 34.1,
    34.11, 34.12, 34.13, 34.14, 34.15, 34.16, 34.17, 34.18, 34.19,
  ];

  const profileTraces = [
    {
      x: temp,
      y: depth,
      mode: "lines+markers",
      name: "Temperature (°C)",
      line: { color: "red" },
    },
    {
      x: sal,
      y: depth,
      mode: "lines+markers",
      name: "Salinity (PSU)",
      line: { color: "blue" },
    },
  ];

  return (
    <div className="relative min-w-[320px] max-w-[380px] rounded-xl bg-white/95 p-3 shadow-lg">
      <button
        aria-label="Close"
        className="absolute top-2 right-2 rounded px-2 py-0.5 font-bold text-gray-500 text-lg hover:text-gray-800 focus:outline-none"
        onClick={onClose}
        type="button"
      >
        ×
      </button>
      <h2 className="mb-2 font-bold text-base text-gray-900">
        Argo Float Profile
      </h2>
      <Plot
        config={{ displayModeBar: false }}
        data={profileTraces}
        layout={{
          title: undefined,
          margin: { t: 16, l: 40, r: 16, b: 40 },
          height: 260,
          xaxis: { title: { text: "Value" }, tickfont: { size: 10 } },
          yaxis: {
            title: { text: "Depth (m)" },
            autorange: "reversed",
            tickfont: { size: 10 },
          },
        }}
        style={{ width: "100%", height: "260px" }}
      />
    </div>
  );
}
