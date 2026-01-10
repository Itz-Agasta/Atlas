// Mock data generators for the enhanced trajectory dashboard charts

interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface DriftData {
  timestamp: string;
  speed: number;
  direction: number;
  latitude: number;
  longitude: number;
  distance: number;
  displacement: number;
}

export interface PositioningData {
  timestamp: string;
  latitude: number;
  longitude: number;
  horizontalAccuracy: number;
  verticalAccuracy?: number;
  satelliteCount: number;
  hdop: number;
  fixType: "GPS" | "DGPS" | "RTK" | "Estimated";
  signalStrength: number;
}

export interface ProfileData {
  depth: number;
  temperature: number;
  salinity: number;
  pressure: number;
  oxygen?: number;
  chlorophyll?: number;
  density: number;
  qualityFlag: number;
  timestamp: string;
}

export interface CyclePhase {
  phase: "surface" | "descent" | "drift" | "ascent" | "surface_transmission";
  startTime: string;
  endTime: string;
  duration: number;
  cycleNumber: number;
  depth?: number;
  temperature?: number;
  notes?: string;
}

export interface BatteryData {
  timestamp: string;
  voltage: number;
  current?: number;
  powerConsumption?: number;
  temperature: number;
  cycleNumber: number;
  phase: "surface" | "descent" | "drift" | "ascent" | "transmission";
  estimatedRemaining?: number;
}

export interface QualityData {
  parameter: "temperature" | "salinity" | "pressure" | "oxygen" | "chlorophyll";
  timestamp: string;
  depth: number;
  value: number;
  qualityFlag: number;
  qcTest: string;
  confidence: number;
  outlierScore?: number;
  profileId: string;
}

export function generateMockDriftData(
  trajectoryPoints: TrajectoryPoint[],
): DriftData[] {
  return trajectoryPoints.slice(1).map((point, index) => {
    const prevPoint = trajectoryPoints[index];
    const lat1 = (prevPoint.latitude * Math.PI) / 180;
    const lat2 = (point.latitude * Math.PI) / 180;
    const deltaLat = ((point.latitude - prevPoint.latitude) * Math.PI) / 180;
    const deltaLon = ((point.longitude - prevPoint.longitude) * Math.PI) / 180;

    // Calculate distance using Haversine formula
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = 6371 * c; // Earth radius in km

    // Calculate time difference in hours
    const timeDiff =
      (new Date(point.timestamp).getTime() -
        new Date(prevPoint.timestamp).getTime()) /
      (1000 * 60 * 60);
    const speed = timeDiff > 0 ? distance / timeDiff : 0;

    // Calculate direction (bearing)
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    const direction = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    // Calculate cumulative distance and displacement from start
    const cumulativeDistance = trajectoryPoints
      .slice(0, index + 2)
      .reduce((total, p, i) => {
        if (i === 0) return 0;
        const prev = trajectoryPoints[i - 1];
        const lat1 = (prev.latitude * Math.PI) / 180;
        const lat2 = (p.latitude * Math.PI) / 180;
        const dLat = ((p.latitude - prev.latitude) * Math.PI) / 180;
        const dLon = ((p.longitude - prev.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return total + 6371 * c;
      }, 0);

    // Displacement from start point
    const startPoint = trajectoryPoints[0];
    const startLat = (startPoint.latitude * Math.PI) / 180;
    const pointLat = (point.latitude * Math.PI) / 180;
    const dLat = ((point.latitude - startPoint.latitude) * Math.PI) / 180;
    const dLon = ((point.longitude - startPoint.longitude) * Math.PI) / 180;
    const aDisp =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(startLat) *
        Math.cos(pointLat) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const cDisp = 2 * Math.atan2(Math.sqrt(aDisp), Math.sqrt(1 - aDisp));
    const displacement = 6371 * cDisp;

    return {
      timestamp: point.timestamp,
      speed: Math.max(0, Math.min(speed, 10)), // Cap at reasonable speed
      direction,
      latitude: point.latitude,
      longitude: point.longitude,
      distance: cumulativeDistance,
      displacement,
    };
  });
}

export function generateMockPositioningData(
  trajectoryPoints: TrajectoryPoint[],
): PositioningData[] {
  return trajectoryPoints.map((point) => ({
    timestamp: point.timestamp,
    latitude: point.latitude,
    longitude: point.longitude,
    horizontalAccuracy: Math.random() * 50 + 5, // 5-55m accuracy
    verticalAccuracy: Math.random() * 20 + 5, // 5-25m accuracy
    satelliteCount: Math.floor(Math.random() * 8) + 4, // 4-12 satellites
    hdop: Math.random() * 3 + 0.5, // 0.5-3.5 HDOP
    fixType: (["GPS", "DGPS", "RTK", "Estimated"] as const)[
      Math.floor(Math.random() * 4)
    ],
    signalStrength: Math.random() * 20 + 30, // 30-50 dB
  }));
}

export function generateMockProfileData(): ProfileData[] {
  const depths = Array.from({ length: 50 }, (_, i) => i * 40); // 0-2000m in 40m steps
  return depths.map((depth) => ({
    depth,
    temperature: 25 - depth / 100 + Math.random() * 2 - 1, // Temperature decreases with depth
    salinity: 34 + Math.random() * 2 - 1, // Around 34 PSU with variation
    pressure: depth * 0.1 + 1013.25, // Approximate pressure in mbar
    oxygen: depth < 1000 ? 8 - depth / 200 + Math.random() * 2 : undefined,
    chlorophyll:
      depth < 200
        ? Math.max(0, 0.5 - depth / 400 + Math.random() * 0.3)
        : undefined,
    density: 1025 + depth / 500 + Math.random() * 0.5,
    qualityFlag:
      Math.random() < 0.8
        ? Math.random() < 0.9
          ? 1
          : 2
        : Math.random() < 0.7
          ? 3
          : 4,
    timestamp: new Date(Date.now() - depth * 60000).toISOString(), // Simulate time progression
  }));
}

export function generateMockCyclePhases(): CyclePhase[] {
  const phases: CyclePhase[] = [];
  const cycleCount = 5;

  for (let cycle = 1; cycle <= cycleCount; cycle++) {
    const baseTime =
      Date.now() - (cycleCount - cycle) * 10 * 24 * 60 * 60 * 1000; // 10 days per cycle

    const phaseSequence = [
      { phase: "surface" as const, duration: 0.5 + Math.random() * 0.5 },
      { phase: "descent" as const, duration: 2 + Math.random() * 1 },
      { phase: "drift" as const, duration: 200 + Math.random() * 40 },
      { phase: "ascent" as const, duration: 3 + Math.random() * 1 },
      {
        phase: "surface_transmission" as const,
        duration: 0.25 + Math.random() * 0.25,
      },
    ];

    let currentTime = baseTime;
    phaseSequence.forEach((phaseInfo) => {
      const duration = phaseInfo.duration;
      const startTime = new Date(currentTime).toISOString();
      currentTime += duration * 60 * 60 * 1000; // Convert hours to milliseconds
      const endTime = new Date(currentTime).toISOString();

      phases.push({
        phase: phaseInfo.phase,
        startTime,
        endTime,
        duration,
        cycleNumber: cycle,
        depth:
          phaseInfo.phase === "drift" ? 1000 + Math.random() * 500 : undefined,
        temperature: 15 + Math.random() * 10,
      });
    });
  }

  return phases;
}

export function generateMockBatteryData(
  trajectoryPoints: TrajectoryPoint[],
): BatteryData[] {
  return trajectoryPoints.map((point, index) => ({
    timestamp: point.timestamp,
    voltage:
      15.0 -
      (index / trajectoryPoints.length) * 0.5 +
      Math.random() * 0.1 -
      0.05, // Gradual decline
    current: 50 + Math.random() * 20, // 50-70 mA
    powerConsumption: 0.75 + Math.random() * 0.3, // 0.75-1.05W
    temperature: 20 + Math.random() * 10, // 20-30°C
    cycleNumber: Math.floor(index / 10) + 1,
    phase: (["surface", "descent", "drift", "ascent", "transmission"] as const)[
      index % 5
    ],
    estimatedRemaining: Math.max(
      0,
      100 - (index / trajectoryPoints.length) * 100 + Math.random() * 5,
    ),
  }));
}

export function generateMockQualityData(): QualityData[] {
  const parameters = [
    "temperature",
    "salinity",
    "pressure",
    "oxygen",
    "chlorophyll",
  ] as const;
  const qcTests = [
    "RangeTest",
    "SpikeTest",
    "RateOfChangeTest",
    "StuckValueTest",
    "GradientTest",
  ];
  const data: QualityData[] = [];

  for (let i = 0; i < 200; i++) {
    const parameter = parameters[Math.floor(Math.random() * parameters.length)];
    const qualityFlag =
      Math.random() < 0.85
        ? Math.random() < 0.95
          ? 1
          : 2
        : Math.random() < 0.8
          ? 3
          : 4;

    data.push({
      parameter,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      depth: Math.random() * 2000,
      value: Math.random() * 100,
      qualityFlag,
      qcTest: qcTests[Math.floor(Math.random() * qcTests.length)],
      confidence:
        qualityFlag <= 2 ? 85 + Math.random() * 15 : 60 + Math.random() * 25,
      outlierScore: Math.random() * 5,
      profileId: `profile_${Math.floor(i / 20) + 1}`,
    });
  }

  return data;
}
