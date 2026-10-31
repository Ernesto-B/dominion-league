import { Component } from 'react';

// A render error in one page must not take down the shell (React unmounts the whole tree on an
// uncaught render error). Remount with a new `resetKey` (the route) to try again after navigating.
export default class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error) { console.error('Page failed to render:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <><h1>Something went wrong</h1><p className="lede">This page failed to render. Try another page, or reload.</p>
      <p className="meta">{String((this.state.error && this.state.error.message) || this.state.error).slice(0, 200)}</p></>;
  }
}
