"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [show, setShow] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            role="tooltip"
            className={`absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-popover dark:bg-white dark:text-slate-900 ${positionClasses[side]}`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
