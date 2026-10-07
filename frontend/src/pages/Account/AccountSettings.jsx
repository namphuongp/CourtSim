import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { UserRound, ShieldCheck, Link2, Monitor } from 'lucide-react';
import api, { getApiError } from '../../services/api';
import { clearAuth, setCurrentUser } from '../../services/auth';
import { PasswordField, GoogleMark } from '../Auth/AuthElements';
import UserHeader from '../../components/UserHeader';
import FeedbackModal from '../../components/feedback/FeedbackModal';
import './account.css';
const when = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thông tin';
const policy = 'Ít nhất 8 ký tự, có chữ hoa và số.';
function useAction() {
  const ref = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function run(action) {
    if (ref.current) return;
    ref.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(getApiError(error, 'Chưa thực hiện được thao tác. Nội dung vẫn được giữ lại. Vui lòng thử lại.')); }
    finally { ref.current = false; setBusy(false); }
  }
  return { busy, error, notice, setNotice, run };
}
function ActionNotice({ action }) {
  return <>{action.error && <p className="account-error" role="alert">{action.error}</p>}{action.notice && <p className="account-success" role="status">{action.notice}</p>}</>;
}
function Profile({ account, update }) {
  const action = useAction();
  const [name, setName] = useState(account.full_name);
  const [verify, setVerify] = useState(false);
  function submit(e) {
    e.preventDefault();
    action.run(async () => { const { data } = await api.patch('/auth/account', { full_name: name }); update(data); setName(data.data.full_name); action.setNotice('Đã lưu hồ sơ.'); });
  }
  return <><section className="account-card"><header className="account-card-heading"><div className="account-avatar" aria-label="Ảnh đại diện bằng chữ cái">{Array.from(account.full_name.trim())[0]?.toLocaleUpperCase('vi-VN') || 'C'}</div><div><h2>Hồ sơ cá nhân</h2><p>Thông tin hiển thị trong CourtSim.</p></div></header><form onSubmit={submit}><fieldset disabled={action.busy}><label htmlFor="account-name">Họ và tên</label><input id="account-name" name="full_name" autoComplete="name" minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} required/><label htmlFor="account-email">Email</label><input id="account-email" value={account.email} readOnly autoComplete="email"/><p className={account.emailVerified ? 'account-verified' : 'account-help'}>{account.emailVerified ? '✓ Đã xác thực email' : 'Chưa xác thực email'}</p><p className="account-help">Email đăng nhập chưa thể thay đổi tại đây.</p>{!account.emailVerified && (account.verificationAvailable ? <button type="button" onClick={() => setVerify(true)}>Xác thực email</button> : <p className="account-help">Xác thực email đang tạm dừng.</p>)}<p className="account-help">Tham gia: {when(account.joinedAt)}</p><ActionNotice action={action}/><button className="account-primary" disabled={action.busy || name.trim() === account.full_name}>{action.busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></fieldset></form></section>{verify && <EmailProof title="Xác thực email" startPath="/auth/account/verification" finishPath="/auth/account/verification/confirm" onClose={() => setVerify(false)} onSuccess={data => { update(data); setVerify(false); }}/>}</>;
}
function EmailProof({ title, startPath, finishPath, onClose, onSuccess, password = false }) {
  const action = useAction();
  const [challenge, setChallenge] = useState(null), [now, setNow] = useState(Date.now);
  const formRef = useRef(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const cooldown = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000)) : 0;
  const expired = challenge && Date.parse(challenge.expiresAt) <= now;
  const send = () => action.run(async () => { const { data } = await api.post(challenge ? '/auth/resend-verification' : startPath, challenge ? { challenge: challenge.challenge } : {}); setChallenge(data.data); action.setNotice('Đã yêu cầu gửi mã. Kiểm tra hộp thư và thư rác.'); setTimeout(() => formRef.current?.elements.otp?.focus(), 0); });
  function submit(e) { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); action.run(async () => { const { data } = await api.post(finishPath, { ...values, challenge: challenge.challenge }); onSuccess(data); }); }
  return <FeedbackModal title={title} onClose={() => { if (!action.busy) onClose(); }}><div className="account-proof"><p>{password ? 'Xác nhận danh tính bằng mã gửi đến email tài khoản trước khi thiết lập mật khẩu.' : 'Xác nhận email bằng mã gửi đến hộp thư của bạn.'}</p>{!challenge ? <button className="account-primary" disabled={action.busy} onClick={send}>{action.busy ? 'Đang gửi…' : 'Gửi mã xác nhận'}</button> : <><form ref={formRef} onSubmit={submit}><fieldset disabled={action.busy}><label htmlFor="account-otp">Mã xác nhận</label><input id="account-otp" name="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required/>{password && <><PasswordField label="Mật khẩu mới" creating/><p className="account-help">{policy}</p><PasswordField label="Xác nhận mật khẩu mới" name="confirm_password" creating/></>}{expired && <p className="account-error">Mã đã hết hạn. Hãy yêu cầu mã mới.</p>}<button className="account-primary" disabled={action.busy || expired}>{action.busy ? 'Đang xác nhận…' : password ? 'Xác nhận và thiết lập mật khẩu' : 'Xác nhận email'}</button></fieldset></form><button disabled={action.busy || cooldown > 0} onClick={send}>{cooldown ? `Gửi lại mã sau ${cooldown} giây` : 'Gửi lại mã'}</button></>}<ActionNotice action={action}/></div></FeedbackModal>;
}
function LoginSessions({ loggedOut }) {
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0), [state, setState] = useState(null), [confirmation, setConfirmation] = useState(null);
  const action = useAction();
  const key = `${page}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/auth/account/sessions?page=${page}`, { signal: controller.signal }).then(({ data }) => setState({ key, data }))
      .catch(error => { if (!controller.signal.aborted) setState({ key, error: getApiError(error) }); });
    return () => controller.abort();
  }, [page, key]);
  const loading = state?.key !== key;
  const revoke = () => action.run(async () => {
    await api.post('/auth/account/' + (confirmation === 'all' ? 'logout-all' : 'logout-others'), {});
    if (confirmation === 'all') { loggedOut('logout'); return; }
    setConfirmation(null); setPage(1); setRevision(v => v + 1); action.setNotice('Đã đăng xuất khỏi các thiết bị khác.');
  });
  return <section className="account-card"><h2>Phiên đăng nhập</h2><p className="account-help">Thiết bị được nhận diện từ thông tin trình duyệt, có thể không hoàn toàn chính xác.</p>{loading ? <p role="status">Đang tải phiên đăng nhập…</p> : state.error ? <p role="alert">{state.error} <button onClick={() => setRevision(v => v + 1)}>Thử lại</button></p> : <>{!state.data.data.length && <p>Không có phiên đăng nhập còn hiệu lực.</p>}<ul className="account-session-list">{state.data.data.map((s, i) => <li key={`${s.createdAt}-${i}`}><Monitor size={24} aria-hidden="true"/><div><strong>{s.device || 'Chưa có thông tin thiết bị'}</strong>{s.current && <span className="account-tag">Phiên hiện tại</span>}<p>Đăng nhập: {when(s.createdAt)}</p><p>Hoạt động gần nhất: {when(s.updatedAt)}</p></div></li>)}</ul>{state.data.pagination.total > 20 && <nav className="account-actions" aria-label="Phân trang phiên đăng nhập"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}</span><button disabled={page * 20 >= state.data.pagination.total} onClick={() => setPage(p => p + 1)}>Sau</button></nav>}</>}<ActionNotice action={action}/><div className="account-actions"><button disabled={action.busy} onClick={() => setConfirmation('others')}>Đăng xuất thiết bị khác</button><button className="account-danger" disabled={action.busy} onClick={() => setConfirmation('all')}>Đăng xuất tất cả thiết bị</button></div>{confirmation && <FeedbackModal title={confirmation === 'all' ? 'Đăng xuất tất cả thiết bị?' : 'Đăng xuất thiết bị khác?'} onClose={() => { if (!action.busy) setConfirmation(null); }}><p>{confirmation === 'all' ? 'Bạn sẽ bị đăng xuất trên tất cả thiết bị, bao gồm trình duyệt này.' : 'Bạn sẽ bị đăng xuất khỏi CourtSim trên các thiết bị khác. Trình duyệt này vẫn đăng nhập.'}</p><ActionNotice action={action}/><div className="feedback-actions"><button disabled={action.busy} onClick={() => setConfirmation(null)}>Hủy</button><button disabled={action.busy} onClick={revoke}>{action.busy ? 'Đang đăng xuất…' : 'Xác nhận đăng xuất'}</button></div></FeedbackModal>}</section>;
}
function Security({ account, loggedOut }) {
  const [mode, setMode] = useState(false);
  const action = useAction();
  function submit(e) { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); action.run(async () => { await api.post('/auth/account/password', values); loggedOut('password'); }); }
  return <><section className="account-card"><h2>Mật khẩu</h2><p>{account.hasPassword ? 'Đã thiết lập mật khẩu.' : 'Chưa thiết lập mật khẩu. Bạn đang đăng nhập bằng Google.'}</p>{!mode ? <button onClick={() => setMode(true)}>{account.hasPassword ? 'Đổi mật khẩu' : 'Thiết lập mật khẩu'}</button> : account.hasPassword ? <form onSubmit={submit}><fieldset disabled={action.busy}><PasswordField label="Mật khẩu hiện tại" name="current_password"/><PasswordField label="Mật khẩu mới" creating/><p className="account-help">{policy}</p><PasswordField label="Xác nhận mật khẩu mới" name="confirm_password" creating/><p className="account-help">Sau khi đổi mật khẩu, tất cả thiết bị sẽ được đăng xuất. Lịch sử luyện tập được giữ nguyên.</p><ActionNotice action={action}/><div className="account-actions"><button className="account-primary" disabled={action.busy}>{action.busy ? 'Đang đổi…' : 'Lưu mật khẩu mới'}</button><button type="button" disabled={action.busy} onClick={() => setMode(false)}>Hủy</button></div></fieldset></form> : <EmailProof title="Thiết lập mật khẩu" startPath="/auth/account/password/otp" finishPath="/auth/account/password/set" password onClose={() => setMode(false)} onSuccess={() => loggedOut('password')}/>}</section><LoginSessions loggedOut={loggedOut}/></>;
}
function Linked({ account, update }) {
  const [params, setParams] = useSearchParams();
  const action = useAction();
  const [mode, setMode] = useState(null);
  async function submit(e) {
    e.preventDefault(); const password = new FormData(e.currentTarget).get('password');
    action.run(async () => {
      if (mode === 'link') { const { data } = await api.post('/auth/google/link', { password }); window.location.assign(data.url); }
      else { const { data } = await api.delete('/auth/account/google', { data: { password } }); update(data); setMode(null); setParams({}, { replace: true }); action.setNotice(data.message); }
    });
  }
  return <><section className="account-card"><h2>Phương thức đăng nhập</h2>{params.get('linked') && account.googleLinked && <p role="status" className="account-success">Google đã được liên kết.</p>}{params.get('googleError') && <p role="alert" className="account-error">Chưa thể liên kết Google. Vui lòng thử lại và chọn tài khoản có cùng email CourtSim.</p>}<article className="account-provider"><ShieldCheck aria-hidden="true"/><div><h3>Email và mật khẩu</h3><p>{account.hasPassword ? 'Đã thiết lập' : 'Chưa thiết lập mật khẩu'}</p>{!account.hasPassword && <Link to="/account/security">Thiết lập mật khẩu →</Link>}</div></article><article className="account-provider"><GoogleMark/><div><h3>Google</h3><p>{account.googleLinked ? '✓ Đã liên kết' : 'Chưa liên kết'}</p>{account.googleEmail && <p>{account.googleEmail}</p>}{account.googleLinked ? account.hasPassword ? <button className="account-danger" onClick={() => setMode('unlink')}>Hủy liên kết Google</button> : <p className="account-help">Bạn cần thiết lập mật khẩu trước khi hủy liên kết Google.</p> : account.emailVerified ? <button onClick={() => setMode('link')}>Liên kết Google</button> : <p className="account-help">Hãy xác thực email trước khi liên kết Google.</p>}</div></article><ActionNotice action={action}/></section>{mode && <FeedbackModal title={mode === 'link' ? 'Liên kết Google' : 'Hủy liên kết Google?'} onClose={() => { if (!action.busy) setMode(null); }}><div className="account-proof"><p>{mode === 'link' ? 'Xác nhận mật khẩu CourtSim, sau đó chọn tài khoản Google có cùng email.' : 'Xác nhận mật khẩu để hủy liên kết. Bạn vẫn đăng nhập được bằng email và mật khẩu, các phiên khác sẽ bị đăng xuất.'}</p><form onSubmit={submit}><fieldset disabled={action.busy}><PasswordField label="Mật khẩu hiện tại"/><ActionNotice action={action}/><div className="account-actions"><button type="button" disabled={action.busy} onClick={() => setMode(null)}>Hủy</button><button className="account-primary" disabled={action.busy}>{action.busy ? 'Đang xử lý…' : mode === 'link' ? 'Tiếp tục với Google' : 'Xác nhận hủy liên kết'}</button></div></fieldset></form></div></FeedbackModal>}</>;
}
export default function AccountSettings() {
  const { section = 'profile' } = useParams();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0), [state, setState] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/auth/account', { signal: controller.signal }).then(({ data }) => setState({ data: data.data }))
      .catch(error => { if (!controller.signal.aborted) { if (error.response?.status === 401) { clearAuth(); navigate('/login?returnTo=/account', { replace: true }); } else setState({ error: getApiError(error) }); } });
    return () => controller.abort();
  }, [revision, navigate]);
  function update(data) { setState(s => ({ data: { ...s.data, ...data.data } })); if (data.user) setCurrentUser(data.user); }
  const loggedOut = reason => { clearAuth(); navigate(reason === 'password' ? '/login?reset=1' : '/login', { replace: true }); };
  return <div className="user-shell"><UserHeader/><main className="account-page account-container user-content"><header className="account-hero"><h1>Tài khoản</h1><p className="account-subtitle">Quản lý hồ sơ và bảo mật tài khoản CourtSim.</p></header><div className="account-layout"><nav aria-label="Cài đặt tài khoản">{[['profile', 'Hồ sơ', UserRound], ['security', 'Bảo mật', ShieldCheck], ['linked', 'Tài khoản liên kết', Link2]].map(([key, title, Icon]) => <NavLink className={section === key ? 'active' : ''} key={key} to={`/account/${key}`}><Icon size={19} aria-hidden="true"/>{title}</NavLink>)}</nav><div className="account-content">{!state ? <p role="status">Đang tải tài khoản…</p> : state.error ? <section className="account-card"><p role="alert">{state.error}</p><button onClick={() => { setState(null); setRevision(v => v + 1); }}>Thử lại</button></section> : section === 'security' ? <Security account={state.data} loggedOut={loggedOut}/> : section === 'linked' ? <Linked account={state.data} update={update}/> : <Profile account={state.data} update={update}/>}</div></div></main></div>;
}
