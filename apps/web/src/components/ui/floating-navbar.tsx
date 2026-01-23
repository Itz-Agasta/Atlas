
"use client";
import React from "react";
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
}) => {
  return (
    <div
      className={cn(
        "flex w-max fixed top-10 left-1/2 -translate-x-1/2 border border-transparent dark:border-white/[0.2] rounded shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] z-[5000] pr-4 pl-8 py-2 items-center justify-center space-x-4",
        className
      )}
      style={{ backgroundColor: "#1b1b1a" }}
    >
      {navItems.map((navItem, idx) => (
        <a
          key={`link=${idx}`}
          href={navItem.link}
          className={cn(
            "relative items-center flex space-x-1 transition-colors px-2 py-1 rounded-md"
          )}
          style={{ color: "#999998" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#303130";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span className="block sm:hidden">{navItem.icon}</span>
          <span className="hidden sm:block text-sm">{navItem.name}</span>
        </a>
      ))}
    </div>
  );
};
