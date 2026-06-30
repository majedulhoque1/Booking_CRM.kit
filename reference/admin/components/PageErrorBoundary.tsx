import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface PageErrorBoundaryProps {
  children: ReactNode;
}

interface PageErrorBoundaryState {
  error?: Error;
  hasError: boolean;
}

export class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  public override state: PageErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Physio OS page render failed", error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <section className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
          <div className="w-full rounded-lg border border-danger/20 bg-surface p-8 text-center shadow-card sm:p-12">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              This page failed to load
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {this.state.error?.message ??
                "An unexpected rendering error happened inside this module."}
            </p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
