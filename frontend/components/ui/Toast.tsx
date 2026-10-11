"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { ToastMessage } from "@/types";

interface ToastContextValue {
  toast: (t: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const badgeStyles = {
  success: "text-[#16A34A] bg-emerald-50 border border-emerald-200",
  error: "text-[#DC2626] bg-red-50 border border-red-200",
  warning: "text-[#D97706] bg-amber-50 border border-amber-200",
  info: "text-[#1976D2] bg-blue-50 border border-blue-200",
};

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).slice(2);

      setToasts((prev) => [
        ...prev,
        {
          ...t,
          id,
        },
      ]);

      setTimeout(() => {
        dismiss(id);
      }, 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {mounted &&
        createPortal(
          <div className="fixed right-4 top-4 z-[200] flex w-full max-w-sm flex-col gap-2.5 pointer-events-none">
            <AnimatePresence>
              {toasts.map((t) => {
                const Icon = icons[t.type] || Info;

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 20, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="pointer-events-auto flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3.5 shadow-lg"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${badgeStyles[t.type] || badgeStyles.info}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <p className="text-xs font-semibold text-[#111F33]">
                        {t.title}
                      </p>

                      {t.description && (
                        <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">
                          {t.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      className="text-[#64748B] hover:text-[#111F33] p-0.5 rounded transition-colors"
                      aria-label="Dismiss toast"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return ctx;
}
