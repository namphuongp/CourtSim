import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import '../../../components/feedback/feedback.css';

const statuses = { new: 'Mới', viewed: 'Đã xem', resolved: 'Đã xử lý' };
const date = value => new Date(value).toLocaleString('vi-VN');

export default function AdminFeedback() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ q: '', status: '', page: 1 });
  const [reload, setReload] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const requestKey = JSON.stringify({ filter, reload });
  const [loadedKey, setLoadedKey] = useState(null);
  const loading = loadedKey !== requestKey;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const detailRequest = useRef(0);
  useEffect(() => {
    let active = true;
    api.get('/v1/admin/feedback', { params: { ...filter, limit: 20 }, timeout: 15000 }).then(({ data }) => {
      if (active) { setItems(data.data); setTotal(data.pagination.total); setError(''); }
    }).catch(error => { if (active) setError(getApiError(error, 'Chưa tải được góp ý. Vui lòng thử lại.')); })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [filter, reload, requestKey]);
  useEffect(() => () => { detailRequest.current++; }, []);

  async function open(item) {
    const request = ++detailRequest.current;
    setError(''); setNotice(''); setOpening(item.id);
    try {
      const { data } = await api.get(`/v1/admin/feedback/${item.id}`, { timeout: 15000 });
      if (request === detailRequest.current) { setSelected(data.data); setDetailError(''); setConfirmDelete(false); }
    } catch (error) { if (request === detailRequest.current) setError(getApiError(error, 'Chưa mở được góp ý. Vui lòng thử lại.')); }
    finally { if (request === detailRequest.current) setOpening(null); }
  }
  async function update(remove = false) {
    if (busy.current) return;
    busy.current = true; setPending(true); setDetailError('');
    try {
      if (remove) await api.delete(`/v1/admin/feedback/${selected.id}`, { timeout: 15000 });
      else await api.patch(`/v1/admin/feedback/${selected.id}`, { status: selected.status, notes: selected.notes }, { timeout: 15000 });
      setSelected(null); setConfirmDelete(false);
      setNotice(remove ? 'Đã xóa góp ý.' : 'Đã lưu trạng thái và ghi chú.');
      if (remove && items.length === 1 && filter.page > 1) setFilter(value => ({ ...value, page: value.page - 1 }));
      else setReload(value => value + 1);
    } catch (error) { setDetailError(getApiError(error, 'Chưa lưu được thay đổi. Nội dung vẫn được giữ lại. Vui lòng thử lại.')); }
    finally { busy.current = false; setPending(false); }
  }
  const close = () => { if (!pending) { if (confirmDelete) setConfirmDelete(false); else setSelected(null); } };
  return <main className="feedback-admin">
    <header><h1>Góp ý của người học</h1><Link to="/admin">← Quản trị CourtSim</Link></header>
    <form className="feedback-filters" onSubmit={event => { event.preventDefault(); setFilter(value => ({ ...value, q: search.trim(), page: 1 })); }}>
      <label>Tìm nội dung hoặc mã phiên<input maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập nội dung cần tìm…" /></label>
      <label>Trạng thái<select value={filter.status} onChange={event => setFilter({ ...filter, status: event.target.value, page: 1 })}><option value="">Tất cả</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit">Tìm kiếm</button>
    </form>
    {notice && <p role="status" className="feedback-success">{notice}</p>}
    {error && !loading && <p role="alert" className="feedback-error">{error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải góp ý…</p> : !error && <>
      <p>{total} góp ý</p>
      {!items.length && <p>Chưa có góp ý phù hợp.</p>}
      <div className="feedback-list">{items.map(item => <article key={item.id}>
        <div className="feedback-meta"><strong>{item.user?.full_name || 'Tài khoản không còn tồn tại'}</strong><time dateTime={item.created_at}>{date(item.created_at)}</time><span>{statuses[item.status]}</span></div>
        <p>{item.content}</p><div className="feedback-meta"><span>Phiên: {item.session_id}</span></div>
        <button className="mt-3" disabled={Boolean(opening)} onClick={() => open(item)}>{opening === item.id ? 'Đang mở…' : 'Xem chi tiết'}</button>
      </article>)}</div>
      {total > 20 && <nav className="feedback-pagination" aria-label="Phân trang góp ý"><button disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>Trước</button><span>Trang {filter.page}/{Math.ceil(total / 20)}</span><button disabled={filter.page * 20 >= total} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Sau</button></nav>}
    </>}
    {selected && <FeedbackModal title={confirmDelete ? 'Xóa góp ý này?' : 'Chi tiết góp ý'} onClose={close}>
      {confirmDelete ? <p>Góp ý và ghi chú nội bộ sẽ bị xóa. Phiên luyện tập và kết quả vẫn được giữ nguyên.</p> : <div className="feedback-detail">
        <p className="feedback-help">{selected.user?.full_name || 'Tài khoản không còn tồn tại'} · {date(selected.created_at)}<br />Phiên: {selected.session_id}</p>
        <p>{selected.content}</p>
        <label htmlFor="feedback-status">Trạng thái</label><select id="feedback-status" disabled={pending} value={selected.status} onChange={event => setSelected({ ...selected, status: event.target.value })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label htmlFor="feedback-notes">Ghi chú nội bộ</label><textarea id="feedback-notes" disabled={pending} maxLength={2000} rows={4} value={selected.notes} onChange={event => setSelected({ ...selected, notes: event.target.value })} />
      </div>}
      {detailError && <p role="alert" className="feedback-error">{detailError}</p>}
      <div className="feedback-actions">{confirmDelete ? <><button autoFocus disabled={pending} onClick={() => setConfirmDelete(false)}>Giữ lại</button><button disabled={pending} className="feedback-delete" onClick={() => update(true)}>{pending ? 'Đang xóa…' : 'Xác nhận xóa'}</button></> : <><button disabled={pending} onClick={() => setConfirmDelete(true)}>Xóa góp ý</button><button disabled={pending} className="feedback-primary" onClick={() => update()}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></>}</div>
    </FeedbackModal>}
  </main>;
}
