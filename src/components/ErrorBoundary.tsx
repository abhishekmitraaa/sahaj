import { Component, type ReactNode } from 'react';

interface Props {
  /** Shown instead of the crashed area; keeps the rest of the app usable. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}

/** Contains a crash to one part of the screen instead of blanking the whole app. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Sahaj recovered from an error:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
