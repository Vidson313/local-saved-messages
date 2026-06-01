"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="tg-error-boundary" role="alert">
          <div className="tg-error-boundary-icon">!</div>
          <strong>Something went wrong</strong>
          <p>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button className="tg-btn-primary" onClick={this.reset}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
