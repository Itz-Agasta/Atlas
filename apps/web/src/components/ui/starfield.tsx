"use client";

import { useMemo } from "react";

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
};

type StarfieldProps = {
  isVisible: boolean;
};

export default function Starfield({ isVisible }: StarfieldProps) {
  // Generate stars with varied sizes and positions
  const stars = useMemo(() => {
    const starArray: Star[] = [];
    const starCount = 200; // Number of stars
    const MAX_POSITION_PERCENT = 100;
    const MAX_SIZE_RANGE = 3;
    const MIN_SIZE_PX = 1;
    const MAX_OPACITY_RANGE = 0.8;
    const MIN_OPACITY = 0.2;
    const MAX_TWINKLE_SPEED_RANGE = 4;
    const MIN_TWINKLE_SPEED_S = 2;

    for (let i = 0; i < starCount; i++) {
      starArray.push({
        id: i,
        x: Math.random() * MAX_POSITION_PERCENT, // Position as percentage
        y: Math.random() * MAX_POSITION_PERCENT,
        size: Math.random() * MAX_SIZE_RANGE + MIN_SIZE_PX, // Size between 1-4px
        opacity: Math.random() * MAX_OPACITY_RANGE + MIN_OPACITY, // Opacity between 0.2-1
        twinkleSpeed:
          Math.random() * MAX_TWINKLE_SPEED_RANGE + MIN_TWINKLE_SPEED_S, // Animation duration 2-6s
      });
    }

    return starArray;
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="-z-10 pointer-events-none fixed inset-0 overflow-hidden">
      {/* Deep space background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #0f0f23 0%, #000000 70%, #000000 100%)",
        }}
      />

      {/* Stars */}
      {stars.map((star) => {
        const GLOW_SIZE_MULTIPLIER = 2;
        const GLOW_OPACITY_FACTOR = 0.5;
        return (
          <div
            className="absolute animate-pulse rounded-full bg-white"
            key={star.id}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDuration: `${star.twinkleSpeed}s`,
              animationDelay: `${Math.random() * star.twinkleSpeed}s`,
              boxShadow: `0 0 ${star.size * GLOW_SIZE_MULTIPLIER}px rgba(255, 255, 255, ${star.opacity * GLOW_OPACITY_FACTOR})`,
            }}
          />
        );
      })}

      {/* Subtle nebula effects */}
      <div
        className="absolute opacity-20"
        style={{
          top: "20%",
          left: "10%",
          width: "300px",
          height: "200px",
          background:
            "radial-gradient(ellipse, rgba(147, 51, 234, 0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute opacity-15"
        style={{
          top: "60%",
          right: "15%",
          width: "250px",
          height: "150px",
          background:
            "radial-gradient(ellipse, rgba(59, 130, 246, 0.3) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute opacity-10"
        style={{
          bottom: "30%",
          left: "30%",
          width: "200px",
          height: "200px",
          background:
            "radial-gradient(ellipse, rgba(236, 72, 153, 0.3) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
