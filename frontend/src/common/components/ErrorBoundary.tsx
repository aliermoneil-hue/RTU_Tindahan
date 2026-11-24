/**
 * Root ErrorBoundary — catches any render/lifecycle error in the app tree
 * and shows it on screen instead of a blank navy #1a2f57 page.
 * Must be a class component (React only supports error boundaries in classes).
 */
import { Component, type ReactNode, type ErrorInfo, type ReactElement } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactElement
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo: errorInfo.componentStack ?? null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          style={{
            padding: 32,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#1a2f57',
            background: '#ffffff',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <h2 style={{ fontSize: 20, margin: 0 }}>RTU Tindahan encountered an error</h2>
          <p style={{ margin: 0, color: '#5f6f87', maxWidth: 420, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          {this.state.errorInfo && (
            <details
              style={{
                marginTop: 12,
                textAlign: 'left',
                width: 'min(90vw, 600px)',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#c0392b',
              }}
            >
              <summary style={{ cursor: 'pointer', marginBottom: 6 }}>Show stack trace</summary>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{this.state.errorInfo}</pre>
            </details>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
                window.location.reload()
              }}
              style={{
                padding: '8px 16px',
                background: '#1a2f57',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.clear()
                  sessionStorage.clear()
                } catch {
                  /* ignore storage errors */
                }
                window.location.reload()
              }}
              style={{
                padding: '8px 16px',
                background: '#f2f5f9',
                color: '#1a2f57',
                border: '1px solid #dde4ee',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Clear local cache & reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
