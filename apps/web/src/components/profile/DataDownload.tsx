"use client";

import { saveAs } from "file-saver";
import { Braces, Database, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FloatMetadata,
  OceanographicData,
} from "@/data/mockOceanographicData";

interface DataDownloadProps {
  data: OceanographicData[];
  metadata: FloatMetadata;
}

export function DataDownload({ data, metadata }: DataDownloadProps) {
  const downloadCSV = () => {
    const headers = [
      "depth_m",
      "temperature_celsius",
      "salinity_psu",
      "dissolved_oxygen_umol_kg",
      "chlorophyll_mg_m3",
      "nitrate_umol_kg",
      "ph",
      "cdom_ppb",
      "chlorophyll_fluorescence_mg_m3",
      "particle_backscattering_m_minus_1",
      "pressure_dbar",
      "density_kg_m3",
    ].join(",");

    const csvContent = [
      `# ARGO Float Data - ${metadata.name}`,
      `# Float ID: ${metadata.id}`,
      `# Cycle: ${metadata.cycleNumber}`,
      `# Date: ${metadata.datetime}`,
      `# Position: ${metadata.position.latitude}°N, ${metadata.position.longitude}°E`,
      `# Institution: ${metadata.institution}`,
      `# Data Mode: ${metadata.dataMode}`,
      `# Quality: ${metadata.quality}`,
      "#",
      headers,
      ...data.map((d) =>
        [
          d.depth,
          d.temperature,
          d.salinity,
          d.dissolvedOxygen,
          d.chlorophyll,
          d.nitrate,
          d.ph,
          d.cdom,
          d.chlorophyllFluorescence,
          d.particleBackscattering,
          d.pressure,
          d.density,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `argo_float_${metadata.id}_cycle_${metadata.cycleNumber}.csv`);
  };

  const downloadNetCDF = () => {
    // For demonstration, we'll create a NetCDF-like text file with metadata
    // In a real application, you would use a proper NetCDF library
    const netcdfContent = [
      "netcdf argo_float_data {",
      "dimensions:",
      `    N_PROF = 1 ;`,
      `    N_LEVELS = ${data.length} ;`,
      "",
      "variables:",
      "    float LATITUDE(N_PROF) ;",
      '        LATITUDE:long_name = "Latitude of the station, best estimate" ;',
      '        LATITUDE:standard_name = "latitude" ;',
      '        LATITUDE:units = "degree_north" ;',
      "",
      "    float LONGITUDE(N_PROF) ;",
      '        LONGITUDE:long_name = "Longitude of the station, best estimate" ;',
      '        LONGITUDE:standard_name = "longitude" ;',
      '        LONGITUDE:units = "degree_east" ;',
      "",
      "    float PRES(N_LEVELS) ;",
      '        PRES:long_name = "Sea water pressure, equals 0 at sea-level" ;',
      '        PRES:standard_name = "sea_water_pressure" ;',
      '        PRES:units = "decibar" ;',
      "",
      "    float TEMP(N_LEVELS) ;",
      '        TEMP:long_name = "Sea temperature in-situ ITS-90 scale" ;',
      '        TEMP:standard_name = "sea_water_temperature" ;',
      '        TEMP:units = "degree_Celsius" ;',
      "",
      "    float PSAL(N_LEVELS) ;",
      '        PSAL:long_name = "Practical salinity" ;',
      '        PSAL:standard_name = "sea_water_salinity" ;',
      '        PSAL:units = "psu" ;',
      "",
      "    float DOXY(N_LEVELS) ;",
      '        DOXY:long_name = "Dissolved oxygen" ;',
      '        DOXY:standard_name = "moles_of_oxygen_per_unit_mass_in_sea_water" ;',
      '        DOXY:units = "micromole/kg" ;',
      "",
      "// global attributes:",
      `        :title = "Argo float vertical profiles" ;`,
      `        :institution = "${metadata.institution}" ;`,
      `        :source = "Argo float" ;`,
      `        :references = "http://www.argodatamgt.org/Documentation" ;`,
      `        :user_manual_version = "3.1" ;`,
      `        :Conventions = "Argo-3.1 CF-1.6" ;`,
      `        :featureType = "trajectoryProfile" ;`,
      `        :data_type = "Argo profile" ;`,
      `        :format_version = "3.1" ;`,
      `        :platform_number = "${metadata.id}" ;`,
      `        :cycle_number = ${metadata.cycleNumber} ;`,
      `        :direction = "${metadata.direction}" ;`,
      `        :data_mode = "${metadata.dataMode}" ;`,
      "",
      "data:",
      "",
      ` LATITUDE = ${metadata.position.latitude} ;`,
      ` LONGITUDE = ${metadata.position.longitude} ;`,
      "",
      ` PRES = ${data.map((d) => d.pressure).join(", ")} ;`,
      "",
      ` TEMP = ${data.map((d) => d.temperature).join(", ")} ;`,
      "",
      ` PSAL = ${data.map((d) => d.salinity).join(", ")} ;`,
      "",
      ` DOXY = ${data.map((d) => d.dissolvedOxygen).join(", ")} ;`,
      "",
      "}",
    ].join("\n");

    const blob = new Blob([netcdfContent], {
      type: "text/plain;charset=utf-8;",
    });
    saveAs(blob, `argo_float_${metadata.id}_cycle_${metadata.cycleNumber}.nc`);
  };

  const downloadJSON = () => {
    const jsonData = {
      metadata: {
        float_id: metadata.id,
        platform_name: metadata.name,
        institution: metadata.institution,
        country: metadata.country,
        data_center: metadata.dataCenter,
        cycle_number: metadata.cycleNumber,
        direction: metadata.direction,
        datetime: metadata.datetime,
        position: {
          latitude: metadata.position.latitude,
          longitude: metadata.position.longitude,
        },
        quality_flag: metadata.quality,
        data_mode: metadata.dataMode,
        number_of_levels: metadata.numberOfLevels,
      },
      data: data.map((d) => ({
        depth_m: d.depth,
        temperature_celsius: d.temperature,
        salinity_psu: d.salinity,
        dissolved_oxygen_umol_kg: d.dissolvedOxygen,
        chlorophyll_mg_m3: d.chlorophyll,
        nitrate_umol_kg: d.nitrate,
        ph: d.ph,
        cdom_ppb: d.cdom,
        chlorophyll_fluorescence_mg_m3: d.chlorophyllFluorescence,
        particle_backscattering_m_minus_1: d.particleBackscattering,
        pressure_dbar: d.pressure,
        density_kg_m3: d.density,
      })),
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    saveAs(
      blob,
      `argo_float_${metadata.id}_cycle_${metadata.cycleNumber}.json`,
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Download className="h-5 w-5" />
          Download Dataset
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={downloadCSV}
            variant="outline"
            className="flex items-center gap-3 h-auto p-4 text-left flex-col hover:bg-muted/50"
          >
            <FileText className="h-8 w-8 text-emerald-600" />
            <div className="text-center">
              <div className="font-semibold text-sm">CSV Format</div>
              <div className="text-xs text-muted-foreground mt-1">
                Excel-compatible spreadsheet format
              </div>
            </div>
          </Button>

          <Button
            onClick={downloadNetCDF}
            variant="outline"
            className="flex items-center gap-3 h-auto p-4 text-left flex-col hover:bg-muted/50"
          >
            <Database className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <div className="font-semibold text-sm">NetCDF Format</div>
              <div className="text-xs text-muted-foreground mt-1">
                Scientific data standard with metadata
              </div>
            </div>
          </Button>

          <Button
            onClick={downloadJSON}
            variant="outline"
            className="flex items-center gap-3 h-auto p-4 text-left flex-col hover:bg-muted/50"
          >
            <Braces className="h-8 w-8 text-purple-600" />
            <div className="text-center">
              <div className="font-semibold text-sm">JSON Format</div>
              <div className="text-xs text-muted-foreground mt-1">
                Structured data for web applications
              </div>
            </div>
          </Button>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <h4 className="font-semibold text-foreground mb-3">
            Dataset Information
          </h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex justify-between">
              <span>Total data points:</span>
              <span className="font-medium text-foreground">{data.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Depth range:</span>
              <span className="font-medium text-foreground">
                {Math.min(...data.map((d) => d.depth))}m -{" "}
                {Math.max(...data.map((d) => d.depth))}m
              </span>
            </div>
            <div className="flex justify-between">
              <span>Quality level:</span>
              <span className="font-medium text-foreground">
                {metadata.quality}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Data mode:</span>
              <span className="font-medium text-foreground">
                {metadata.dataMode}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            Data follows Argo project standards and includes quality control
            flags. Please cite the appropriate data sources when using this data
            in publications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
