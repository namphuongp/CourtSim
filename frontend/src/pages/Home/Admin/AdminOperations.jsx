import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { useAdminData, date } from './adminData';
import { LoadState, Pagination } from './AdminElements';

const vnd = value => value == null ? 'ChÆ°a cÃ³ dá»¯ liá»‡u' : new Intl.NumberFormat('vi-VN').format(value) + ' VNÄ';

export function AdminPayments() {
  const [filter, setFilter] = useState({ page: 1, q: '', status: 'pending', sort: 'created_at', order: 'desc' });
  const [action, setAction] = useState({ id: '', busy: false, error: '', notice: '' });
  const resource = useAdminData('/v1/admin/payments?' + new URLSearchParams(filter));
  const change = (key, value) => setFilter(f => ({ ...f, [key]: value, page: 1 }));
  async function updatePayment(transactionId, status) {
    setAction({ id: transactionId, busy: true, error: '', notice: '' });
    try {
      await api.patch(`/v1/admin/payments/${transactionId}`, { status }, { timeout: 15000 });
      setAction({ id: '', busy: false, error: '', notice: status === 'success' ? 'ÄÃ£ xÃ¡c nháº­n thanh toÃ¡n vÃ  má»Ÿ quyá»n sá»­ dá»¥ng.' : 'ÄÃ£ tá»« chá»‘i giao dá»‹ch.' });
      resource.reload();
    } catch (error) {
      setAction({ id: transactionId, busy: false, error: getApiError(error, 'ChÆ°a xá»­ lÃ½ Ä‘Æ°á»£c giao dá»‹ch.'), notice: '' });
    }
  }
  const statusLabel = value => ({ pending: 'Cho chuyen khoan', processing: 'Dang xac minh', paid: 'Da thanh toan', expired: 'Da het han', cancelled: 'Da huy', submitted: 'Cho xac minh', success: 'Da xac minh', failed: 'Da tu choi', refunded: 'Da hoan tien' }[value] ?? value);
  return <><header className="admin-page-heading"><div><h1>Thanh toÃ¡n</h1><p>Theo dÃµi webhook chuyá»ƒn khoáº£n; xá»­ lÃ½ thá»§ cÃ´ng khi giao dá»‹ch cáº§n Ä‘á»‘i soÃ¡t láº¡i.</p></div></header>
    {action.notice && <p className="admin-notice" role="status">{action.notice}</p>}
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); change('q', new FormData(e.currentTarget).get('q').trim()); }}>
      <label>TÃ¬m giao dá»‹ch<input name="q" maxLength={100} placeholder="MÃ£ giao dá»‹ch, tÃªn hoáº·c email" /></label><button>TÃ¬m kiáº¿m</button>
      <label>Tráº¡ng thÃ¡i<select value={filter.status} onChange={e => change('status', e.target.value)}><option value="">Táº¥t cáº£</option><option value="pending">Cho chuyen khoan</option><option value="processing">Dang xac minh</option><option value="paid">Da thanh toan</option><option value="expired">Da het han</option><option value="cancelled">Da huy</option></select></label>
      <label>Sáº¯p xáº¿p<select value={filter.sort} onChange={e => change('sort', e.target.value)}><option value="created_at">NgÃ y táº¡o</option><option value="updated_at">Cáº­p nháº­t</option><option value="amount">Sá»‘ tiá»n</option><option value="status">Tráº¡ng thÃ¡i</option></select></label>
      <label>Thá»© tá»±<select value={filter.order} onChange={e => change('order', e.target.value)}><option value="desc">Giáº£m dáº§n</option><option value="asc">TÄƒng dáº§n</option></select></label>
    </form>
    <LoadState resource={resource}>{d => <section className="admin-card">{!d.data.length ? <p className="admin-empty">ChÆ°a cÃ³ giao dá»‹ch phÃ¹ há»£p.</p> : <div className="admin-table-scroll"><table><thead><tr>{['Giao dá»‹ch', 'NgÆ°á»i dÃ¹ng', 'GÃ³i', 'Sá»‘ tiá»n', 'Ná»™i dung CK', 'Tráº¡ng thÃ¡i', 'Thá»i gian', 'Xá»­ lÃ½'].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{d.data.map(item => <tr key={item.transaction_id}><td><strong>{item.transaction_id}</strong><small>{item.payment?.account_name} Â· {item.payment?.account_mask}</small></td><td>{item.user ? <Link to={`/admin/users/${item.user._id}`}>{item.user.username}</Link> : 'TÃ i khoáº£n khÃ´ng cÃ²n tá»“n táº¡i'}<small>{item.user?.email}</small></td><td>{item.plan?.name}<small>{item.plan?.payment_purpose}</small></td><td>{vnd(item.amount)}</td><td>{item.payment?.transfer_content}</td><td><span className="admin-badge">{statusLabel(item.status)}</span><small>{item.user_confirmed_at ? `BÃ¡o Ä‘Ã£ chuyá»ƒn: ${date(item.user_confirmed_at)}` : ''}</small></td><td>{date(item.created_at)}<small>Cáº­p nháº­t: {date(item.updated_at)}</small></td><td>{['pending'].includes(item.status) ? <div className="admin-payment-actions"><button disabled={action.busy && action.id === item.transaction_id} onClick={() => updatePayment(item.transaction_id, 'success')}>XÃ¡c nháº­n</button><button className="admin-danger" disabled={action.busy && action.id === item.transaction_id} onClick={() => updatePayment(item.transaction_id, 'failed')}>Tá»« chá»‘i</button>{action.id === item.transaction_id && action.error && <small role="alert">{action.error}</small>}</div> : 'â€”'}</td></tr>)}</tbody></table></div>}<Pagination pagination={d.pagination} onChange={page => setFilter({ ...filter, page })}/></section>}</LoadState>
  </>;
}

export { default as AdminAi } from './AdminAi';

export function AdminSystem() {
  const resource = useAdminData('/v1/admin/system/health');
  return <><header className="admin-page-heading"><div><h1>Há»‡ thá»‘ng</h1><p>Tráº¡ng thÃ¡i káº¿t ná»‘i vÃ  cáº¥u hÃ¬nh, khÃ´ng gá»i model Ä‘á»ƒ kiá»ƒm tra.</p></div><button onClick={resource.reload} disabled={resource.loading}>LÃ m má»›i</button></header><LoadState resource={resource}>{({ data: d }) => <><section className="admin-card"><dl className="admin-facts">{[['Backend', d.backend, 'Äang hoáº¡t Ä‘á»™ng'], ['MongoDB', d.mongo, 'ÄÃ£ káº¿t ná»‘i'], ['Dá»‹ch vá»¥ AI', d.aiConfigured, 'ÄÃ£ cáº¥u hÃ¬nh'], ['Email', d.emailConfigured, 'ÄÃ£ cáº¥u hÃ¬nh'], ['Google OAuth', d.googleConfigured, 'ÄÃ£ cáº¥u hÃ¬nh'], ['Theo dÃµi AI', d.trackingEnabled, 'ÄÃ£ báº­t'], ['Báº£ng giÃ¡ AI', d.pricingConfigured, 'ÄÃ£ cáº¥u hÃ¬nh']].map(([label, ok, text]) => <div className="admin-fact-row" key={label}><dt>{label}</dt><dd><span className={`admin-badge ${ok ? 'admin-ok' : 'admin-warning'}`}>{ok ? text : 'ChÆ°a sáºµn sÃ ng'}</span></dd></div>)}</dl><p>Láº§n gá»i AI thÃ nh cÃ´ng gáº§n nháº¥t: {date(d.lastAiSuccess)}</p><p>Kiá»ƒm tra lÃºc: {date(d.checkedAt)}</p><p className="admin-note">CÃ³ cáº¥u hÃ¬nh khÃ´ng báº£o Ä‘áº£m nhÃ  cung cáº¥p Ä‘ang hoáº¡t Ä‘á»™ng hoáº·c khÃ³a cÃ²n há»£p lá»‡.</p></section>{d.verificationTemporarilyDisabled && <p className="admin-notice">Äang táº¡m bá» qua xÃ¡c minh email trong mÃ´i trÆ°á»ng phÃ¡t triá»ƒn.</p>}</>}</LoadState></>;
}
export function AdminAudit() {
  const [page, setPage] = useState(1);
  const resource = useAdminData(`/v1/admin/audit?page=${page}`);
  return <><h1>Hoáº¡t Ä‘á»™ng quáº£n trá»‹</h1><p>Lá»‹ch sá»­ cÃ¡c thay Ä‘á»•i Ä‘Æ°á»£c ghi nháº­n ká»ƒ tá»« khi báº­t chá»©c nÄƒng.</p><LoadState resource={resource}>{d => <section className="admin-card">{!d.data.length ? <p>ChÆ°a cÃ³ hoáº¡t Ä‘á»™ng quáº£n trá»‹.</p> : <div className="admin-table-scroll"><table><thead><tr><th>Thá»i gian</th><th>Quáº£n trá»‹ viÃªn</th><th>HÃ nh Ä‘á»™ng</th><th>Äá»‘i tÆ°á»£ng</th></tr></thead><tbody>{d.data.map(e => <tr key={e._id}><td>{date(e.created_at)}</td><td>{e.admin_user_id?.username || 'TÃ i khoáº£n khÃ´ng cÃ²n tá»“n táº¡i'}</td><td>{{ USER_DISABLED: 'VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n', USER_ENABLED: 'Má»Ÿ láº¡i tÃ i khoáº£n', FEEDBACK_STATUS_CHANGED: 'Cáº­p nháº­t gÃ³p Ã½', FEEDBACK_DELETED: 'XÃ³a gÃ³p Ã½', PAYMENT_APPROVED: 'XÃ¡c nháº­n thanh toÃ¡n', PAYMENT_REJECTED: 'Tá»« chá»‘i thanh toÃ¡n' }[e.action]}</td><td><Link to={e.target_type === 'user' ? `/admin/users/${e.target_id}` : e.target_type === 'payment' ? '/admin/payments' : '/admin/feedback'}>{e.target_id}</Link></td></tr>)}</tbody></table></div>}<Pagination pagination={d.pagination} onChange={setPage}/></section>}</LoadState></>;
}


