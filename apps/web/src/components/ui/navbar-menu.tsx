"use client";
import { motion } from "motion/react";
import Image from "next/image";
import type React from "react";

const transition = {
  type: "spring",
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
} as const;

export const MenuItem = ({
  setActive,
  active,
  item,
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className="relative"
      onFocus={() => setActive(item)}
      onMouseEnter={() => setActive(item)}
    >
      <motion.p
        className="cursor-pointer text-black hover:opacity-[0.9] dark:text-white"
        transition={{ duration: 0.3 }}
      >
        {item}
      </motion.p>
      {active !== null && (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          transition={transition}
        >
          {active === item && (
            <div className="-translate-x-1/2 absolute top-[calc(100%_+_1.2rem)] left-1/2 transform pt-4">
              <motion.div
                className="overflow-hidden rounded-2xl border border-black/[0.2] bg-white shadow-xl backdrop-blur-sm dark:border-white/[0.2] dark:bg-black"
                layoutId="active" // layoutId ensures smooth animation
                transition={transition}
              >
                <motion.div
                  className="h-full w-max p-4" // layout ensures smooth animation
                  layout
                >
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const Menu = ({
  setActive,
  children,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
}) => {
  return (
    <nav
      className="relative flex justify-center space-x-4 rounded-full border border-transparent bg-white px-8 py-6 shadow-input dark:border-white/[0.2] dark:bg-black" // resets the state
      onMouseLeave={() => setActive(null)}
    >
      {children}
    </nav>
  );
};

export const ProductItem = ({
  title,
  description,
  href,
  src,
}: {
  title: string;
  description: string;
  href: string;
  src: string;
}) => (
  <a className="flex space-x-2" href={href}>
    <Image
      alt={title}
      className="shrink-0 rounded-md shadow-2xl"
      height={70}
      src={src}
      width={140}
    />
    <div>
      <h4 className="mb-1 font-bold text-black text-xl dark:text-white">
        {title}
      </h4>
      <p className="max-w-[10rem] text-neutral-700 text-sm dark:text-neutral-300">
        {description}
      </p>
    </div>
  </a>
);

export const HoveredLink = ({ children, ...rest }: any) => (
  <a
    {...rest}
    className="text-neutral-700 hover:text-black dark:text-neutral-200"
  >
    {children}
  </a>
);
