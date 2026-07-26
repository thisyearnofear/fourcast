'use client';

import { Component } from 'react';

/**
 * ErrorBoundary — Catches render errors and displays a fallback UI.
 * 
 * Prevents entire app crashes when individual components fail.
 * Shows error details in development, generic message in production.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
      // TODO: Send to Sentry, LogRocket, etc.
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback, showDetails = process.env.NODE_ENV === 'development' } = this.props;
      
      if (fallback) {
        return typeof fallback === 'function' 
          ? fallback({ error: this.state.error, reset: this.handleReset })
          : fallback;
      }

      return (
        <div className="p-6 border border-[var(--color-breach)] bg-[var(--color-paper)] text-center">
          <div className="text-[var(--color-breach)] text-lg font-semibold mb-2">
            Something went wrong
          </div>
          <div className="text-[var(--color-ink-muted)] text-sm mb-4">
            This component encountered an error and couldn't render.
          </div>
          
          {showDetails && this.state.error && (
            <details className="text-left mb-4">
              <summary className="cursor-pointer text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-[var(--color-paper-raised)] text-xs overflow-auto max-h-48">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-accent-hover)]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * withErrorBoundary — HOC wrapper for functional components.
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
