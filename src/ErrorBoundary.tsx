import { Component, type ReactNode } from 'react';

/** 화면 그리는 중 예기치 못한 오류가 나도 하얀 화면 대신 안내를 보여준다 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) { console.error('[앱 오류]', error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="auth"><div className="card-auth">
        <h1>문제가 발생했어요</h1>
        <p className="notice">화면을 불러오는 중 오류가 났습니다. 새로고침해 보시고, 계속되면 편집자에게 알려주세요.</p>
        <button className="primary" onClick={() => location.reload()}>새로고침</button>
        <details><summary>오류 내용 (문의할 때 함께 알려주세요)</summary><pre className="errpre">v{__APP_VERSION__} · {this.state.error.message}</pre></details>
      </div></main>
    );
  }
}
