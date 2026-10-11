"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-6xl",
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[#111F33]/60 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={cn(
              "relative w-full max-h-[calc(100vh-2rem)] flex flex-col rounded-lg border border-[#E2E8F0] bg-white shadow-xl overflow-hidden",
              sizeClasses[size]
            )}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
              <div className="min-w-0 pr-4">
                <h2 id="modal-title" className="text-base font-semibold tracking-tight text-[#111F33]">
                  {title}
                </h2>
                {description && (
                  <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {children}
            </div>

            {/* Modal Footer */}
            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F5F7FA]/60 px-5 py-3 sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
