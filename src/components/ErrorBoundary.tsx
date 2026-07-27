import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// Top-level boundary so a render error shows a recoverable screen instead of a
// blank window. Technical details are logged, not shown raw to the user.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[intelleson] render error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="boot">
          <div className="boot-logo">◈</div>
          <h2>Something went wrong</h2>
          <p className="muted">The interface hit an unexpected error.</p>
          <button className="btn primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
