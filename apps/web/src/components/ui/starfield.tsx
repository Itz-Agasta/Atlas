"use client";

import { useMemo } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
}

interface StarfieldProps {
  isVisible: boolean;
}

export default function Starfield({ isVisible }: StarfieldProps) {
  // Generate stars with varied sizes and positions
  const stars = useMemo(() => {
    const starArray: Star[] = [];
    const starCount = 200; // Number of stars

    for (let i = 0; i < starCount; i++) {
      starArray.push({
        id: i,
        x: Math.random() * 100, // Position as percentage
        y: Math.random() * 100,
        size: Math.random() * 3 + 1, // Size between 1-4px
        opacity: Math.random() * 0.8 + 0.2, // Opacity between 0.2-1
        twinkleSpeed: Math.random() * 4 + 2, // Animation duration 2-6s
      });
    }

    return starArray;
  }, []);

  if (!isVisible) return null;

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
      {stars.map((star) => (
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
            boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, ${star.opacity * 0.5})`,
          }}
        />
      ))}

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
