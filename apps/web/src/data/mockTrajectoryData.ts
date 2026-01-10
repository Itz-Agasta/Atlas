import type { LatLngTuple } from "leaflet";

export interface TrajectoryPoint {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth?: number;
  temperature?: number;
  salinity?: number;
  status: "active" | "completed" | "current";
}

export interface FloatTrajectory {
  floatId: string;
  floatNumber: string;
  startDate: string;
  endDate?: string;
  platformType: string;
  status: "active" | "completed" | "lost";
  points: TrajectoryPoint[];
  totalDistance: number; // in kilometers
  missionDuration: number; // in days

  // About Float Information
  wmo: string;
  platformMaker: string;
  floatSerial: string;
  transmissionSystem: string;
  ptt: string;
  owner: string;
  dataCentre: string;
  sensors: string[];

  // Deployment Information
  deploymentDate: string;
  deploymentLatitude: number;
  deploymentLongitude: number;
  ship: string;
  cruise: string;
  project: string;
  principalInvestigator: string;

  // Cycle Activity
  age: number; // in years
  lastProfileDate: string;
  cycle: number;
  lastSurfaceData: {
    pressure: number;
    temperature: number;
    salinity: number;
  };
  lastBottomData: {
    pressure: number;
    temperature: number;
    salinity: number;
  };
  profilesData: {
    ascii: string;
    netcdf: string;
  };

  // Quality Control and Metadata
  qualityControl: {
    dataMode: "A" | "R" | "D"; // A=Automatic, R=Real-time, D=Delayed mode
    positionQC: number; // Quality flags 1-9
    temperatureQC: number;
    salinityQC: number;
    pressureQC: number;
    lastQCDate: string;
    qcPerformed: string[];
  };

  dataProcessing: {
    processingLevel: "L0" | "L1" | "L2" | "L3";
    calibrationDate: string;
    softwareVersion: string;
    processingHistory: string[];
    verticalSampling: string;
    dataRecovery: number; // percentage
  };
}

// Generate realistic trajectory data for different regions
export const generateMockTrajectoryData = (
  floatId: string,
): FloatTrajectory => {
  const regions = [
    { name: "Bay of Bengal", center: [15.0, 90.0], bounds: 8 },
    { name: "Arabian Sea", center: [18.0, 65.0], bounds: 10 },
    { name: "Central Indian Ocean", center: [-10.0, 80.0], bounds: 15 },
    { name: "Southwest Indian Ocean", center: [-25.0, 70.0], bounds: 12 },
    { name: "Andaman Sea", center: [12.0, 95.0], bounds: 6 },
  ];

  const region = regions[Math.floor(Math.random() * regions.length)];
  const [centerLat, centerLon] = region.center;
  const boundRange = region.bounds;

  const pointCount = Math.floor(Math.random() * 50) + 20; // 20-70 points
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 24)); // Up to 2 years ago

  const points: TrajectoryPoint[] = [];
  let currentLat = centerLat + (Math.random() - 0.5) * boundRange;
  let currentLon = centerLon + (Math.random() - 0.5) * boundRange;
  let totalDistance = 0;

  for (let i = 0; i < pointCount; i++) {
    const timestamp = new Date(startDate);
    timestamp.setDate(startDate.getDate() + i * 10); // Every 10 days

    // Add some realistic drift patterns
    const drift = {
      lat: (Math.random() - 0.5) * 2, // Max 2 degrees drift
      lon: (Math.random() - 0.5) * 3, // Max 3 degrees drift
    };

    const prevLat = currentLat;
    const prevLon = currentLon;

    currentLat += drift.lat;
    currentLon += drift.lon;

    // Keep within bounds
    currentLat = Math.max(
      centerLat - boundRange,
      Math.min(centerLat + boundRange, currentLat),
    );
    currentLon = Math.max(
      centerLon - boundRange,
      Math.min(centerLon + boundRange, currentLon),
    );

    // Calculate distance from previous point (simplified)
    if (i > 0) {
      const latDiff = currentLat - prevLat;
      const lonDiff = currentLon - prevLon;
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Rough km conversion
      totalDistance += distance;
    }

    const status =
      i === pointCount - 1
        ? "current"
        : i < pointCount - 5
          ? "completed"
          : "active";

    points.push({
      id: i + 1,
      latitude: parseFloat(currentLat.toFixed(6)),
      longitude: parseFloat(currentLon.toFixed(6)),
      timestamp: timestamp.toISOString(),
      depth: Math.random() * 2000 + 500, // 500-2500m depth
      temperature: Math.random() * 15 + 2, // 2-17°C
      salinity: Math.random() * 2 + 34, // 34-36 PSU
      status,
    });
  }

  const missionDuration = Math.floor(
    (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    floatId,
    floatNumber: `WMO${floatId}`,
    startDate: startDate.toISOString(),
    endDate: Math.random() > 0.7 ? new Date().toISOString() : undefined,
    platformType: ["APEX", "SOLO", "NOVA", "ARVOR"][
      Math.floor(Math.random() * 4)
    ],
    status:
      Math.random() > 0.8
        ? "completed"
        : Math.random() > 0.95
          ? "lost"
          : "active",
    points,
    totalDistance: parseFloat(totalDistance.toFixed(2)),
    missionDuration,

    // About Float Information
    wmo: floatId,
    platformMaker: ["TWR", "SBE", "NKE", "METOCEAN"][
      Math.floor(Math.random() * 4)
    ],
    floatSerial: Math.floor(Math.random() * 90000 + 10000).toString(),
    transmissionSystem: "IRIDIUM",
    ptt:
      Math.random() > 0.3
        ? Math.floor(Math.random() * 90000 + 10000).toString()
        : "n/a",
    owner: ["STEPHEN RISER", "INDIA METEOROLOGICAL DEPT", "CSIRO", "JAMSTEC"][
      Math.floor(Math.random() * 4)
    ],
    dataCentre: ["AOML", "INCOIS", "CSIRO", "JMA"][
      Math.floor(Math.random() * 4)
    ],
    sensors: [
      "CTD_CNDC",
      "CTD_TEMP",
      "CTD_PRES",
      ...(Math.random() > 0.5 ? ["DOXY"] : []),
    ],

    // Deployment Information
    deploymentDate: startDate.toISOString(),
    deploymentLatitude: parseFloat(currentLat.toFixed(6)),
    deploymentLongitude: parseFloat(currentLon.toFixed(6)),
    ship: [
      "R/V Kaharoa II",
      "ORV Sagar Nidhi",
      "R/V Investigator",
      "R/V Mirai",
    ][Math.floor(Math.random() * 4)],
    cruise: `CR-${new Date().getFullYear()}-${Math.floor(Math.random() * 20 + 1)
      .toString()
      .padStart(2, "0")}`,
    project: [
      "US ARGO PROJECT",
      "INDIAN ARGO PROJECT",
      "AUSTRALIAN ARGO",
      "JAPAN ARGO",
    ][Math.floor(Math.random() * 4)],
    principalInvestigator: [
      "STEPHEN RISER",
      "DR. RAJESH KUMAR",
      "DR. SUSAN WIJFFELS",
      "DR. TOSHIO SUGA",
    ][Math.floor(Math.random() * 4)],

    // Cycle Activity
    age: parseFloat((missionDuration / 365).toFixed(2)),
    lastProfileDate: new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    cycle: Math.floor(missionDuration / 10) + Math.floor(Math.random() * 5),
    lastSurfaceData: {
      pressure: parseFloat((Math.random() * 10 + 2).toFixed(1)),
      temperature: parseFloat((Math.random() * 5 + 25).toFixed(3)),
      salinity: parseFloat((Math.random() * 2 + 34).toFixed(2)),
    },
    lastBottomData: {
      pressure: parseFloat((Math.random() * 500 + 1500).toFixed(1)),
      temperature: parseFloat((Math.random() * 3 + 2).toFixed(3)),
      salinity: parseFloat((Math.random() * 2 + 34.5).toFixed(2)),
    },
    profilesData: {
      ascii: `/data/${floatId}_profiles.ascii`,
      netcdf: `/data/${floatId}_profiles.nc`,
    },

    // Quality Control and Metadata
    qualityControl: {
      dataMode: ["A", "R", "D"][Math.floor(Math.random() * 3)] as
        | "A"
        | "R"
        | "D",
      positionQC: Math.floor(Math.random() * 3) + 1, // 1-3 (good quality)
      temperatureQC: Math.floor(Math.random() * 3) + 1,
      salinityQC: Math.floor(Math.random() * 3) + 1,
      pressureQC: Math.floor(Math.random() * 3) + 1,
      lastQCDate: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      qcPerformed: [
        "Range test",
        "Spike test",
        "Gradient test",
        "Pressure increasing test",
        "Global range test",
      ].slice(0, Math.floor(Math.random() * 3) + 3),
    },

    dataProcessing: {
      processingLevel: ["L1", "L2", "L3"][Math.floor(Math.random() * 3)] as
        | "L1"
        | "L2"
        | "L3",
      calibrationDate: new Date(
        Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      softwareVersion: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      processingHistory: [
        "Automated quality control applied",
        "Manual review completed",
        "Delayed mode calibration",
        "Salinity drift correction",
      ].slice(0, Math.floor(Math.random() * 2) + 2),
      verticalSampling: `${Math.floor(Math.random() * 5) + 1}dbar`,
      dataRecovery: Math.floor(Math.random() * 20) + 80, // 80-100%
    },
  };
};

// Pre-generated trajectories for consistent testing
export const mockTrajectories: Record<string, FloatTrajectory> = {
  "4903464": {
    floatId: "4903464",
    floatNumber: "WMO4903464",
    startDate: "2023-03-15T12:00:00Z",
    platformType: "APEX",
    status: "active",
    totalDistance: 1247.5,
    missionDuration: 558,

    // About Float Information
    wmo: "4903464",
    platformMaker: "TWR",
    floatSerial: "10629",
    transmissionSystem: "IRIDIUM",
    ptt: "n/a",
    owner: "STEPHEN RISER",
    dataCentre: "AOML",
    sensors: ["CTD_CNDC", "CTD_TEMP", "CTD_PRES"],

    // Deployment Information
    deploymentDate: "2024-04-12T18:18:00Z",
    deploymentLatitude: 15.5,
    deploymentLongitude: 89.2,
    ship: "R/V Kaharoa II",
    cruise: "KAH-2024-03",
    project: "US ARGO PROJECT",
    principalInvestigator: "STEPHEN RISER",

    // Cycle Activity
    age: 0.79,
    lastProfileDate: "2025-09-18T16:56:44Z",
    cycle: 29,
    lastSurfaceData: {
      pressure: 4.3,
      temperature: 28.661,
      salinity: 34.13,
    },
    lastBottomData: {
      pressure: 1996.7,
      temperature: 2.236,
      salinity: 34.62,
    },
    profilesData: {
      ascii: "/data/4903464_profiles.ascii",
      netcdf: "/data/4903464_profiles.nc",
    },

    qualityControl: {
      dataMode: "D",
      positionQC: 1,
      temperatureQC: 1,
      salinityQC: 2,
      pressureQC: 1,
      lastQCDate: "2025-09-15T08:30:00Z",
      qcPerformed: [
        "Range test",
        "Spike test",
        "Gradient test",
        "Pressure increasing test",
        "Global range test",
      ],
    },

    dataProcessing: {
      processingLevel: "L3",
      calibrationDate: "2025-08-01T00:00:00Z",
      softwareVersion: "v3.2.1",
      processingHistory: [
        "Automated quality control applied",
        "Manual review completed",
        "Delayed mode calibration",
        "Salinity drift correction",
      ],
      verticalSampling: "2dbar",
      dataRecovery: 94,
    },

    points: [
      {
        id: 1,
        latitude: 15.123456,
        longitude: 88.876543,
        timestamp: "2023-03-15T12:00:00Z",
        depth: 1500.5,
        temperature: 28.2,
        salinity: 34.8,
        status: "completed",
      },
      {
        id: 2,
        latitude: 14.987654,
        longitude: 89.123456,
        timestamp: "2023-03-25T12:00:00Z",
        depth: 1750.2,
        temperature: 27.8,
        salinity: 34.9,
        status: "completed",
      },
      {
        id: 3,
        latitude: 14.654321,
        longitude: 90.789012,
        timestamp: "2023-04-04T12:00:00Z",
        depth: 1920.8,
        temperature: 27.5,
        salinity: 35.1,
        status: "completed",
      },
      {
        id: 4,
        latitude: 13.321098,
        longitude: 91.456789,
        timestamp: "2023-04-14T12:00:00Z",
        depth: 1680.3,
        temperature: 28.1,
        salinity: 34.7,
        status: "active",
      },
      {
        id: 5,
        latitude: 12.987654,
        longitude: 92.123456,
        timestamp: "2023-04-24T12:00:00Z",
        depth: 1555.7,
        temperature: 28.6,
        salinity: 34.6,
        status: "current",
      },
    ],
  },
  "4903465": {
    floatId: "4903465",
    floatNumber: "WMO4903465",
    startDate: "2023-01-10T08:30:00Z",
    platformType: "SOLO",
    status: "active",
    totalDistance: 2156.3,
    missionDuration: 620,

    // About Float Information
    wmo: "4903465",
    platformMaker: "SBE",
    floatSerial: "11842",
    transmissionSystem: "IRIDIUM",
    ptt: "12345",
    owner: "INDIA METEOROLOGICAL DEPARTMENT",
    dataCentre: "INCOIS",
    sensors: ["CTD_CNDC", "CTD_TEMP", "CTD_PRES", "DOXY"],

    // Deployment Information
    deploymentDate: "2023-01-10T08:30:00Z",
    deploymentLatitude: 18.5,
    deploymentLongitude: 65.8,
    ship: "ORV Sagar Nidhi",
    cruise: "SN-2023-01",
    project: "INDIAN ARGO PROJECT",
    principalInvestigator: "DR. RAJESH KUMAR",

    // Cycle Activity
    age: 1.7,
    lastProfileDate: "2025-09-20T14:22:15Z",
    cycle: 45,
    lastSurfaceData: {
      pressure: 3.8,
      temperature: 26.125,
      salinity: 36.28,
    },
    lastBottomData: {
      pressure: 1850.4,
      temperature: 2.891,
      salinity: 36.45,
    },
    profilesData: {
      ascii: "/data/4903465_profiles.ascii",
      netcdf: "/data/4903465_profiles.nc",
    },

    qualityControl: {
      dataMode: "R",
      positionQC: 1,
      temperatureQC: 1,
      salinityQC: 1,
      pressureQC: 2,
      lastQCDate: "2025-09-19T10:15:00Z",
      qcPerformed: ["Range test", "Spike test", "Global range test"],
    },

    dataProcessing: {
      processingLevel: "L2",
      calibrationDate: "2025-07-15T00:00:00Z",
      softwareVersion: "v2.8.4",
      processingHistory: [
        "Automated quality control applied",
        "Manual review completed",
      ],
      verticalSampling: "3dbar",
      dataRecovery: 88,
    },

    points: [
      {
        id: 1,
        latitude: 18.456789,
        longitude: 65.876543,
        timestamp: "2023-01-10T08:30:00Z",
        depth: 1200.0,
        temperature: 26.5,
        salinity: 36.2,
        status: "completed",
      },
      {
        id: 2,
        latitude: 17.123456,
        longitude: 66.654321,
        timestamp: "2023-01-20T08:30:00Z",
        depth: 1450.5,
        temperature: 25.8,
        salinity: 36.3,
        status: "completed",
      },
      {
        id: 3,
        latitude: 16.789012,
        longitude: 67.321098,
        timestamp: "2023-01-30T08:30:00Z",
        depth: 1680.2,
        temperature: 24.9,
        salinity: 36.5,
        status: "completed",
      },
      {
        id: 4,
        latitude: 15.456789,
        longitude: 68.987654,
        timestamp: "2023-02-09T08:30:00Z",
        depth: 1590.8,
        temperature: 25.2,
        salinity: 36.4,
        status: "active",
      },
      {
        id: 5,
        latitude: 14.123456,
        longitude: 69.654321,
        timestamp: "2023-02-19T08:30:00Z",
        depth: 1720.1,
        temperature: 24.5,
        salinity: 36.6,
        status: "current",
      },
    ],
  },
};

export const getTrajectoryData = (floatId: string): FloatTrajectory => {
  // Return pre-defined trajectory if it exists, otherwise generate a new one
  return mockTrajectories[floatId] || generateMockTrajectoryData(floatId);
};

export const getTrajectoryCoordinates = (
  trajectory: FloatTrajectory,
): LatLngTuple[] => {
  return trajectory.points.map(
    (point) => [point.latitude, point.longitude] as LatLngTuple,
  );
};
