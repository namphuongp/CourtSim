import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import CaseDossier from '../../../components/CaseDossier';
import { useAdminData } from './adminData';
import { LoadState, Pagination } from './AdminElements';

const emptyCase = () => ({ title: '', category: 'dân sự', summary: '', full_document: '', evidence_inventory: [] });

export default function AdminCases() {
  const [page, setPage] = useState(1);
  const resource = useAdminData(`/v1/cases?limit=10&page=${page}`);
  const [form, setForm] = useState(emptyCase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [detail, setDetail] = useState({});
  const lock = useRef(false);
  const detailRequest = useRef(0);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateEvidence = (id, key, value) => setForm(current => ({ ...current,
    evidence_inventory: current.evidence_inventory.map(item => item.id === id ? { ...item, [key]: value } : item),
  }));

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const payload = { ...form, title: form.title.trim(), category: form.category.trim(), summary: form.summary.trim(), full_document: form.full_document.trim(),
      evidence_inventory: form.evidence_inventory.map(({ id, ...item }) => ({ ...item, name: item.name.trim(),
        content: item.availability === 'provided' ? item.content : '',
      })),
    };
    if (![payload.title, payload.category, payload.summary, payload.full_document].every(Boolean)
      || payload.evidence_inventory.some(item => !item.name || (item.availability === 'provided' && !item.content.trim()))) {
      setError('Điền đầy đủ thông tin hồ sơ và nội dung của chứng cứ được cung cấp.');
      return;
    }
    lock.current = true; setBusy(true); setError(''); setCreated(null);
    try {
      const { data } = await api.post('/v1/cases', payload, { timeout: 20000 });
      setCreated(data.data); setForm(emptyCase()); setPage(1); resource.reload();
    } catch (failure) {
      setError(getApiError(failure, 'Chưa xác nhận được việc tạo vụ án. Nội dung đã nhập vẫn được giữ lại. Kiểm tra danh sách vụ án trước khi thử lại.'));
    } finally { lock.current = false; setBusy(false); }
  }

  async function viewCase(id) {
    const request = ++detailRequest.current;
    setDetail({ loading: true });
    try {
      const { data } = await api.get(`/v1/cases/${id}`);
      if (request === detailRequest.current) setDetail({ data: data.data });
    } catch (failure) {
      if (request === detailRequest.current) setDetail({ error: getApiError(failure) });
    }
  }

  return <>
    <header className="admin-page-heading"><div><h1>Hồ sơ vụ án</h1><p>Tạo tình huống luyện tập và xem hồ sơ đang có trong hệ thống.</p></div></header>
    {created && <p className="admin-notice" role="status">Đã tạo vụ án “{created.title}”. <Link to="/dashboard/setup">Chọn vụ án để luyện tập →</Link></p>}
    <section className="admin-card" aria-labelledby="create-case-heading">
      <h2 id="create-case-heading">Tạo vụ án</h2>
      <p>Nhập tình huống đã ẩn danh. Chỉ thêm chứng cứ có trong hồ sơ, giữ nguyên nội dung trích dẫn.</p>
      <form className="admin-case-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Tên vụ án<input required maxLength={200} value={form.title} onChange={e => update('title', e.target.value)} /></label>
          <label>Loại vụ án<input required maxLength={80} value={form.category} onChange={e => update('category', e.target.value)} /></label>
          <label>Tóm tắt vụ án<textarea required rows={4} maxLength={4000} value={form.summary} onChange={e => update('summary', e.target.value)} /></label>
          <label>Nội dung hồ sơ<textarea required rows={10} maxLength={50000} value={form.full_document} onChange={e => update('full_document', e.target.value)} /></label>
          <h3>Danh sách chứng cứ</h3>
          {!form.evidence_inventory.length && <p>Chưa thêm chứng cứ. Bạn vẫn có thể tạo hồ sơ chỉ gồm nội dung tình huống.</p>}
          {form.evidence_inventory.map((item, index) => <fieldset className="admin-evidence-form" key={item.id}>
            <legend>Chứng cứ {index + 1}</legend>
            <label>Tên chứng cứ {index + 1}<input required maxLength={200} value={item.name} onChange={e => updateEvidence(item.id, 'name', e.target.value)} /></label>
            <label>Trạng thái chứng cứ {index + 1}<select value={item.availability} onChange={e => updateEvidence(item.id, 'availability', e.target.value)}><option value="provided">Có nội dung được cung cấp</option><option value="mentioned_only">Chỉ được nhắc đến trong hồ sơ</option></select></label>
            <label>Mô tả chứng cứ {index + 1}<textarea rows={2} maxLength={2000} value={item.summary} onChange={e => updateEvidence(item.id, 'summary', e.target.value)} /></label>
            {item.availability === 'provided' && <label>Nội dung chứng cứ {index + 1}<textarea required rows={4} maxLength={10000} value={item.content} onChange={e => updateEvidence(item.id, 'content', e.target.value)} /></label>}
            <button type="button" className="admin-danger" onClick={() => update('evidence_inventory', form.evidence_inventory.filter(evidence => evidence.id !== item.id))}>Xóa chứng cứ {index + 1}</button>
          </fieldset>)}
          <button type="button" disabled={form.evidence_inventory.length >= 50} onClick={() => update('evidence_inventory', [...form.evidence_inventory, { id: crypto.randomUUID(), name: '', availability: 'provided', summary: '', content: '' }])}>Thêm chứng cứ</button>
          {error && <p role="alert">{error}</p>}
          <div className="admin-case-actions"><button type="submit">{busy ? 'Đang tạo vụ án…' : 'Tạo vụ án'}</button></div>
        </fieldset>
      </form>
    </section>
    <section className="admin-card" aria-labelledby="case-list-heading">
      <h2 id="case-list-heading">Vụ án hiện có</h2>
      <LoadState resource={resource}>{result => <>
        {!result.data.length ? <p>Chưa có vụ án.</p> : <ul className="admin-case-list">{result.data.map(item => <li key={item._id}><div><strong>{item.title}</strong><p>{item.category} · {item.summary}</p></div><button onClick={() => viewCase(item._id)}>Xem hồ sơ: {item.title}</button></li>)}</ul>}
        <Pagination pagination={result.pagination} onChange={setPage} />
      </>}</LoadState>
    </section>
    {(detail.loading || detail.error || detail.data) && <section className="admin-card" aria-label="Chi tiết hồ sơ">
      {detail.loading ? <p role="status">Đang tải hồ sơ…</p> : detail.error ? <p role="alert">{detail.error}</p> : <CaseDossier key={detail.data._id} courtCase={detail.data} />}
    </section>}
  </>;
}
