import { Component } from 'react';
import '../pages/Auth/auth.css';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <main className="auth-page"><section className="auth-card">
      <h1>Chưa thể mở trang</h1>
      <p role="alert">Trang gặp lỗi khi hiển thị. Hãy tải lại để tiếp tục. Các lượt luyện tập đã lưu trong tài khoản có thể mở lại sau đó.</p>
      <button className="auth-primary" onClick={() => window.location.reload()}>Tải lại trang</button>
      <a className="auth-secondary" href="/">Về trang chủ</a>
    </section></main>;
    return this.props.children;
  }
}
