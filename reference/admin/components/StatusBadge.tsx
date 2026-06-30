import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type StatusTone =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "indigo"
  | "purple"
  | "orange"
  | "gray";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize tracking-wide",
  {
    variants: {
      tone: {
        blue: "bg-sky-50 text-sky-700",
        green: "bg-emerald-50 text-emerald-700",
        red: "bg-rose-50 text-rose-700",
        yellow: "bg-amber-50 text-amber-700",
        indigo: "bg-indigo-50 text-indigo-700",
        purple: "bg-violet-50 text-violet-700",
        orange: "bg-orange-50 text-orange-700",
        gray: "bg-stone-100 text-stone-600",
      },
    },
    defaultVariants: {
      tone: "gray",
    },
  },
);

interface StatusBadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof badgeVariants>, "tone"> {
  label: string;
  tone?: StatusTone;
}

export function StatusBadge({
  className,
  label,
  tone,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {label}
    </span>
  );
}
