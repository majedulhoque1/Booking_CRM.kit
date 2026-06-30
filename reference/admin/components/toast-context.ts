import { createContext } from "react";

interface ToastInput {
  description?: string;
  title: string;
  variant: "error" | "success";
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
