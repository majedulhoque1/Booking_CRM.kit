import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type AccentColor = "indigo" | "emerald" | "blue" | "red" | "green" | "orange";

interface StatCardProps {
  label: string;
  /** Optional trend badge. When omitted, no badge is rendered (e.g. live metrics with no comparison). */
  trend?: string;
  trendDirection?: "down" | "up";
  value: string;
  valueTone?: "danger" | "default";
  icon?: LucideIcon;
  accentColor?: AccentColor;
  className?: string;
}

const accentStyles: Record<AccentColor, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  blue: { bg: "bg-sky-50", text: "text-sky-600" },
  red: { bg: "bg-rose-50", text: "text-rose-600" },
  green: { bg: "bg-emerald-50", text: "text-emerald-600" },
  orange: { bg: "bg-amber-50", text: "text-amber-600" },
};

export function StatCard({
  label,
  trend,
  trendDirection,
  value,
  valueTone = "default",
  icon: Icon,
  accentColor,
  className,
}: StatCardProps) {
  const TrendIcon = trendDirection === "down" ? ArrowDownRight : ArrowUpRight;
  const accent = accentColor ? accentStyles[accentColor] : null;

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-white p-4 sm:p-5 shadow-card transition-shadow hover:shadow-elevated",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {Icon && accent ? (
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              accent.bg,
              accent.text,
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}

        {trend !== undefined ? (
          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              trendDirection === "down"
                ? "bg-rose-50 text-rose-600"
                : "bg-emerald-50 text-emerald-600",
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trend}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-3 text-2xl sm:text-[28px] font-semibold leading-none tracking-tight",
          valueTone === "danger" ? "text-danger" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">{label}</p>
    </article>
  );
}
