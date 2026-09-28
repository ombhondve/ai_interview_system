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

const colors = {
  success: "text-success-600 bg-success-50 dark:bg-success-500/10",
  error: "text-danger-600 bg-danger-50 dark:bg-danger-500/10",
  warning: "text-warning-600 bg-warning-50 dark:bg-warning-500/10",
  info: "text-info-600 bg-info-50 dark:bg-info-500/10",
};

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  // Wait until the component is mounted in the browser
  // before creating the portal.
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
          <div className="fixed right-4 top-4 z-[200] flex w-full max-w-sm flex-col gap-2">
            <AnimatePresence>
              {toasts.map((t) => {
                const Icon = icons[t.type];

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.2 }}
                    className="surface flex items-start gap-3 rounded-xl border p-3.5 shadow-popover"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors[t.type]}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {t.title}
                      </p>

                      {t.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {t.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => dismiss(t.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label="Dismiss"
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