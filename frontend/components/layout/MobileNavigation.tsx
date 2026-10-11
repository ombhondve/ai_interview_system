"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] lg:hidden overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[#111F33]/70 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className="relative h-full w-[260px] max-w-[85vw] shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute -right-11 top-4 flex h-9 w-9 items-center justify-center rounded-md bg-[#111F33] text-white border border-white/20 shadow-md transition-colors hover:bg-[#1a2d47]"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar mobile onNavigate={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
