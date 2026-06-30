import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  description: string;
  icon: LucideIcon;
  title: string;
}

export function EmptyState({ description, icon: Icon, title }: EmptyStateProps) {
  return (
    <section className="flex min-h-[calc(100vh-16rem)] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-dashed border-border bg-white p-10 text-center shadow-card">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
}
