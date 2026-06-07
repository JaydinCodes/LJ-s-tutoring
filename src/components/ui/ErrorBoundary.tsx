import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { ErrorState } from './State';

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[Project Odysseus] App render error', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
          <div className="mx-auto mt-20 max-w-2xl">
            <ErrorState
              title="Portal screen unavailable"
              description="This screen hit an unexpected error. Refresh the page or return to the dashboard."
              onRetry={() => this.setState({ error: null })}
            />
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
