<<<<<<< HEAD
import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import {
  AnimatePresence,
  MotionValue,
=======
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import {
  AnimatePresence,
  type MotionValue,
>>>>>>> main
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
<<<<<<< HEAD

import { useRef, useState } from "react";
=======
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Magnification effect constants - these are animation design values
// biome-ignore lint/style/noMagicNumbers: Animation constants are intentional design values
const MOUSE_DISTANCE_RANGE = [-150, 0, 150];
// biome-ignore lint/style/noMagicNumbers: Animation constants are intentional design values
const ITEM_SIZE_RANGE = [40, 80, 40];
// biome-ignore lint/style/noMagicNumbers: Animation constants are intentional design values
const ICON_SIZE_RANGE = [20, 40, 20];
const ANIMATION_DELAY_STEP = 0.05;
>>>>>>> main

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: { title: string; icon: React.ReactNode; href: string }[];
  desktopClassName?: string;
  mobileClassName?: string;
<<<<<<< HEAD
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};
=======
}) => (
  <>
    <FloatingDockDesktop className={desktopClassName} items={items} />
    <FloatingDockMobile className={mobileClassName} items={items} />
  </>
);
>>>>>>> main

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string }[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
<<<<<<< HEAD
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
=======
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
            layoutId="nav"
          >
            {items.map((item, idx) => (
              <motion.div
>>>>>>> main
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  transition: {
<<<<<<< HEAD
                    delay: idx * 0.05,
                  },
                }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <a
                  href={item.href}
                  key={item.title}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-900"
=======
                    delay: idx * ANIMATION_DELAY_STEP,
                  },
                }}
                initial={{ opacity: 0, y: 10 }}
                key={item.title}
                transition={{
                  delay: (items.length - 1 - idx) * ANIMATION_DELAY_STEP,
                }}
              >
                <a
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-900"
                  href={item.href}
                  key={item.title}
>>>>>>> main
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </a>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
<<<<<<< HEAD
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
=======
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
        onClick={() => setOpen(!open)}
        type="button"
>>>>>>> main
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string }[];
  className?: string;
}) => {
<<<<<<< HEAD
  let mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 md:flex dark:bg-neutral-900",
        className,
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
=======
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  return (
    <motion.div
      className={cn(
        "mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 md:flex dark:bg-neutral-900",
        className
      )}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      onMouseMove={(e) => mouseX.set(e.pageX)}
    >
      {items.map((item) => (
        <IconContainer key={item.title} mouseX={mouseX} {...item} />
>>>>>>> main
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  href,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.ReactNode;
  href: string;
}) {
<<<<<<< HEAD
  let ref = useRef<HTMLDivElement>(null);

  let distance = useTransform(mouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
=======
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
>>>>>>> main

    return val - bounds.x - bounds.width / 2;
  });

<<<<<<< HEAD
  let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  let heightTransformIcon = useTransform(
    distance,
    [-150, 0, 150],
    [20, 40, 20],
  );

  let width = useSpring(widthTransform, {
=======
  const widthTransform = useTransform(
    distance,
    MOUSE_DISTANCE_RANGE,
    ITEM_SIZE_RANGE
  );
  const heightTransform = useTransform(
    distance,
    MOUSE_DISTANCE_RANGE,
    ITEM_SIZE_RANGE
  );

  const widthTransformIcon = useTransform(
    distance,
    MOUSE_DISTANCE_RANGE,
    ICON_SIZE_RANGE
  );
  const heightTransformIcon = useTransform(
    distance,
    MOUSE_DISTANCE_RANGE,
    ICON_SIZE_RANGE
  );

  const width = useSpring(widthTransform, {
>>>>>>> main
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
<<<<<<< HEAD
  let height = useSpring(heightTransform, {
=======
  const height = useSpring(heightTransform, {
>>>>>>> main
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

<<<<<<< HEAD
  let widthIcon = useSpring(widthTransformIcon, {
=======
  const widthIcon = useSpring(widthTransformIcon, {
>>>>>>> main
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
<<<<<<< HEAD
  let heightIcon = useSpring(heightTransformIcon, {
=======
  const heightIcon = useSpring(heightTransformIcon, {
>>>>>>> main
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);

  return (
    <a href={href}>
      <motion.div
<<<<<<< HEAD
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex aspect-square items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800"
=======
        className="relative flex aspect-square items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        ref={ref}
        style={{ width, height }}
>>>>>>> main
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
<<<<<<< HEAD
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
=======
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              className="-top-8 absolute left-1/2 w-fit whitespace-pre rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-neutral-700 text-xs dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              initial={{ opacity: 0, y: 10, x: "-50%" }}
>>>>>>> main
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
<<<<<<< HEAD
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
=======
          className="flex items-center justify-center"
          style={{ width: widthIcon, height: heightIcon }}
>>>>>>> main
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  );
}
