"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "tween", duration: 0.2 }}
            className="relative h-full"
          >
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="absolute -right-10 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
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
