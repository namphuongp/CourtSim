import { useId, useState } from 'react';
import { Eye, EyeOff, Scale, CheckCircle2 } from 'lucide-react';
import CourtSimMark from '../../components/CourtSimMark';
import { Link } from 'react-router-dom';
import './auth.css';

export function AuthShell({ children }) {
  return <main className="auth-page auth-split"><aside className="auth-story"><Link to="/" className="auth-story-brand" aria-label="CourtSim — Trang chủ"><CourtSimMark />CourtSim</Link><Scale className="auth-story-emblem" aria-hidden="true" /><div className="auth-story-copy"><h2>LUYỆN TRANH TỤNG<br />VỚI PHIÊN TÒA AI</h2><ul><li><CheckCircle2 />Thực hành nhập vai qua các tình huống mô phỏng</li><li><CheckCircle2 />Chủ tọa và bên đối lập do AI đảm nhiệm</li><li><CheckCircle2 />Nhận phản hồi sau phiên để tiến bộ mỗi ngày</li></ul></div><small>© {new Date().getFullYear()} CourtSim · Mô phỏng phục vụ học tập</small></aside><div className="auth-form-area"><section className="auth-card"><Link to="/" className="auth-brand" aria-label="CourtSim — Trang chủ"><CourtSimMark /><span>Court<span>Sim</span></span></Link>{children}</section><footer className="auth-footer"><Link to="/guide">Hướng dẫn sử dụng</Link><Link to="/">Về trang chủ</Link></footer></div></main>;
}
export function PasswordField({ name = 'password', label = 'Mật khẩu', creating = false, forgot = false, error, onChange }) {
  const id = useId(); const [visible, setVisible] = useState(false); const [caps, setCaps] = useState(false);
  return <div className="auth-field"><div className="auth-label-row"><label htmlFor={id}>{label}</label>{forgot && <Link to="/forgot-password">Quên mật khẩu?</Link>}</div><div className="auth-password"><input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined} maxLength={128} required aria-invalid={Boolean(error)} aria-describedby={error || caps ? `${id}-message` : undefined} onChange={onChange} onKeyUp={e => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} /><button type="button" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{(error || caps) && <p id={`${id}-message`} className={error ? 'auth-field-error' : 'auth-hint'}>{error || 'Caps Lock đang bật.'}</p>}</div>;
}
export function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;
}
