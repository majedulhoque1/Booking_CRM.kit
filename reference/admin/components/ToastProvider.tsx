import {
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { ToastContext } from "./toast-context";

type ToastVariant = "error" | "success";

interface ToastItem {
  description?: string;
  id: string;
  title: string;
  variant: ToastVariant;
}

interface ToastInput {
  description?: string;
  title: string;
  variant: ToastVariant;
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function dismiss(id: string) {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }

  function toast(input: ToastInput) {
    const id = `toast-${Date.now()}-${toastCounter}`;
    toastCounter += 1;

    setToasts((currentToasts) => [...currentToasts, { id, ...input }]);

    window.setTimeout(() => {
      dismiss(id);
    }, 3000);
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((item) => {
          const Icon = item.variant === "success" ? CheckCircle2 : AlertCircle;

          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto rounded-lg border bg-surface p-4 shadow-lg",
                item.variant === "success"
                  ? "border-success/20"
                  : "border-danger/20",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full",
                    item.variant === "success"
                      ? "bg-success/10 text-success"
                      : "bg-danger/10 text-danger",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label="Dismiss toast"
                  onClick={() => dismiss(item.id)}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
