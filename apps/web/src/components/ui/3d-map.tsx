"use client";
import MapLibreGL from "maplibre-gl";
//maplibre gl component for alternative options
import { useEffect, useMemo, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapLibre3DMap({
  setIs3D,
}: {
  setIs3D: (is3D: boolean) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreGL.Map | null>(null);

  const floats = useMemo(() => {
    const numFloats = 10;
    return Array.from({ length: numFloats }, () => ({
      id: Math.random().toString(),
      lat: (Math.random() - 0.5) * 180,
      lng: (Math.random() - 0.5) * 360,
    }));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapRef.current = new MapLibreGL.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      zoom: 2,
      center: [0, 0],
    });

    const map = mapRef.current;

    map.on("style.load", () => {
      // Modify water to black
      if (map.getLayer("water")) {
        map.setPaintProperty("water", "fill-color", "#000000");
      }
      // Modify land/continents to dark grey
      if (map.getLayer("land")) {
        map.setPaintProperty("land", "fill-color", "#2d2d2d");
      }
      if (map.getLayer("background")) {
        map.setPaintProperty("background", "background-color", "#333333");
      }

      map.setProjection({
        type: "globe",
      });

      // Set font for text layers
      map.getStyle().layers.forEach((layer) => {
        if (
          layer.type === "symbol" &&
          layer.layout &&
          "text-font" in layer.layout
        ) {
          map.setLayoutProperty(layer.id, "text-font", ["TASA Orbiter Bold"]);
          map.setPaintProperty(layer.id, "text-color", "#ffffff");
        }
      });

      // Add markers for floats
      floats.forEach((float) => {
        const marker = new MapLibreGL.Marker({ color: "#3FB1CE" })
          .setLngLat([float.lng, float.lat])
          .setPopup(
            new MapLibreGL.Popup({ offset: 25 }).setHTML(
              `<h3>Float ${float.id}</h3><p>Lat: ${float.lat.toFixed(2)}, Lng: ${float.lng.toFixed(2)}</p>`
            )
          )
          .addTo(map);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [floats]);

  return (
    <div className="relative h-full w-full">
      <div
        className="h-full w-full"
        ref={mapContainerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
