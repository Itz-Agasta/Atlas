"use client";
import type React from "react";
import { cn } from "@/lib/utils";

export const FloatingNav = ({
  navItems,
  className,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: React.ReactNode;
  }[];
  className?: string;
}) => (
  <div
    className={cn(
      "-translate-x-1/2 fixed top-10 left-1/2 z-[5000] flex w-max items-center justify-center space-x-4 rounded border border-transparent py-2 pr-4 pl-8 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] dark:border-white/[0.2]",
      className
    )}
    style={{ backgroundColor: "#1b1b1a" }}
  >
    {navItems.map((navItem, idx) => (
      <a
        className={cn(
          "relative flex items-center space-x-1 rounded-md px-2 py-1 transition-colors"
        )}
        href={navItem.link}
        key={`link=${idx}`}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#303130";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        style={{ color: "#999998" }}
      >
        <span className="block sm:hidden">{navItem.icon}</span>
        <span className="hidden text-sm sm:block">{navItem.name}</span>
      </a>
    ))}
  </div>
);
