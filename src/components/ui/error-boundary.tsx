import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[350px] w-full flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4 border border-destructive/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {this.props.fallbackTitle ?? 'Something went wrong rendering this component'}
          </h2>
          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {this.state.error?.message ?? 'An unexpected runtime error occurred.'}
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-1.5 text-xs font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs font-medium"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
