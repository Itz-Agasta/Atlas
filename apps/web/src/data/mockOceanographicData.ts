export interface OceanographicData {
  depth: number;
  temperature: number; // Celsius
  salinity: number; // PSU (Practical Salinity Units)
  dissolvedOxygen: number; // μmol/kg
  chlorophyll: number; // mg/m³
  nitrate: number; // μmol/kg
  ph: number; // pH units
  cdom: number; // ppb (parts per billion)
  chlorophyllFluorescence: number; // mg/m³
  particleBackscattering: number; // m⁻¹
  pressure: number; // dbar
  density: number; // kg/m³
}

export interface FloatMetadata {
  id: string;
  name: string;
  country: string;
  institution: string;
  status: "Active" | "Inactive" | "Dead";
  dataCenter: string;
  cycleNumber: number;
  direction: "Ascending" | "Descending";
  datetime: string;
  quality: number;
  numberOfLevels: number;
  dataMode: string;
  position: {
    latitude: number;
    longitude: number;
  };
  qualityFlag: number;
}

// Generate realistic oceanographic data based on depth profiles
export function generateMockOceanographicData(
  depths: number[],
): OceanographicData[] {
  return depths.map((depth) => {
    // Temperature decreases with depth (thermocline effect)
    const temperature =
      depth < 100
        ? 28 - depth * 0.15 // Surface mixed layer
        : depth < 1000
          ? 15 - (depth - 100) * 0.008 // Thermocline
          : 4 - (depth - 1000) * 0.002; // Deep water

    // Salinity increases slightly with depth
    const salinity = 34.5 + depth * 0.0005 + Math.random() * 0.1 - 0.05;

    // Dissolved oxygen decreases in middle depths (oxygen minimum zone)
    const dissolvedOxygen =
      depth < 200
        ? 220 - depth * 0.5 // Surface waters
        : depth < 800
          ? 80 + Math.sin(depth * 0.01) * 20 // OMZ variability
          : 150 + (depth - 800) * 0.05; // Deep water increase

    // Chlorophyll decreases exponentially with depth
    const chlorophyll = Math.max(
      0.01,
      2.5 * Math.exp(-depth / 150) + Math.random() * 0.1,
    );

    // Nitrate increases with depth
    const nitrate =
      depth < 100
        ? 0.5 + Math.random() * 0.5
        : Math.min(45, 5 + depth * 0.02 + Math.random() * 2);

    // pH decreases slightly with depth
    const ph = 8.1 - depth * 0.0002 + Math.random() * 0.05 - 0.025;

    // CDOM varies with depth and location
    const cdom = 0.8 + Math.sin(depth * 0.005) * 0.3 + Math.random() * 0.2;

    // Chlorophyll fluorescence correlates with chlorophyll
    const chlorophyllFluorescence = chlorophyll * 0.8 + Math.random() * 0.1;

    // Particle backscattering decreases with depth
    const particleBackscattering = Math.max(
      0.0001,
      0.005 * Math.exp(-depth / 200) + Math.random() * 0.0005,
    );

    // Pressure increases linearly with depth
    const pressure = depth * 1.025; // Approximate conversion

    // Density increases with depth
    const density = 1024 + depth * 0.003 + (35 - temperature) * 0.8;

    return {
      depth,
      temperature: Math.round(temperature * 100) / 100,
      salinity: Math.round(salinity * 100) / 100,
      dissolvedOxygen: Math.round(dissolvedOxygen * 10) / 10,
      chlorophyll: Math.round(chlorophyll * 100) / 100,
      nitrate: Math.round(nitrate * 10) / 10,
      ph: Math.round(ph * 100) / 100,
      cdom: Math.round(cdom * 100) / 100,
      chlorophyllFluorescence: Math.round(chlorophyllFluorescence * 100) / 100,
      particleBackscattering:
        Math.round(particleBackscattering * 1000000) / 1000000,
      pressure: Math.round(pressure * 10) / 10,
      density: Math.round(density * 100) / 100,
    };
  });
}

export function getMockFloatMetadata(floatId: string): FloatMetadata {
  return {
    id: floatId,
    name: `NAVIS_EBR Profiling Float ${floatId}`,
    country: "India",
    institution:
      "Indian National Centre for Ocean Information Services (INCOIS)",
    status: "Active",
    dataCenter: "INCOIS",
    cycleNumber: 20,
    direction: "Ascending",
    datetime: "15/09/2025 11:31:48",
    quality: 1,
    numberOfLevels: 517,
    dataMode: "Real-time adjusted",
    position: {
      latitude: 15.0288, // Bay of Bengal coordinates for India
      longitude: 85.1384,
    },
    qualityFlag: 1,
  };
}

// Generate standard depth levels for oceanographic profiles
export function generateDepthLevels(): number[] {
  const depths: number[] = [];

  // Surface layers (0-100m) - high resolution
  for (let i = 0; i <= 100; i += 5) {
    depths.push(i);
  }

  // Mid-water (100-1000m) - medium resolution
  for (let i = 110; i <= 1000; i += 10) {
    depths.push(i);
  }

  // Deep water (1000-2000m) - lower resolution
  for (let i = 1020; i <= 2000; i += 20) {
    depths.push(i);
  }

  return depths;
}

export const mockDepths = generateDepthLevels();
export const mockData = generateMockOceanographicData(mockDepths);
