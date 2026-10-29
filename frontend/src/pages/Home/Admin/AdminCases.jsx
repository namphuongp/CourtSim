import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Eye, Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api, { getApiError } from '../../../services/api';
import CaseDossier from '../../../components/CaseDossier';
import { useAdminData } from './adminData';
import { LoadState, Pagination } from './AdminElements';

const emptyCase = () => ({ title: '', category: 'dân sự', summary: '', full_document: '', evidence_inventory: [] });

export default function AdminCases() {
  const [page, setPage] = useState(1);
  const resource = useAdminData(`/v1/cases?limit=10&page=${page}`);
  const [form, setForm] = useState(emptyCase);
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState(null);
  const [detail, setDetail] = useState({});
  const formRef = useRef(null);
  const lock = useRef(false);
  const detailRequest = useRef(0);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateEvidence = (id, key, value) => setForm(current => ({
    ...current,
    evidence_inventory: current.evidence_inventory.map(item => item.id === id ? { ...item, [key]: value } : item),
  }));

  async function startEdit(item) {
    if (lock.current) return;
    setError('');
    setNotice('');
    setCreated(null);
    setBusy(true);

    try {
      const { data } = await api.get(`/v1/cases/${item._id}`);
      const caseData = data.data;
      setForm({
        title: caseData.title || '',
        category: caseData.category || 'dân sự',
        summary: caseData.summary || '',
        full_document: caseData.full_document || '',
        evidence_inventory: (caseData.evidence_inventory || []).map(e => ({
          id: e.id || crypto.randomUUID(),
          name: e.name || '',
          availability: e.availability || 'provided',
          summary: e.summary || '',
          content: e.content || '',
        })),
      });
      setEditingCaseId(caseData._id);
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (failure) {
      setError(getApiError(failure, 'Chưa tải được đầy đủ thông tin vụ án để chỉnh sửa.'));
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditingCaseId(null);
    setForm(emptyCase());
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const payload = {
      ...form,
      title: form.title.trim(),
      category: form.category.trim(),
      summary: form.summary.trim(),
      full_document: form.full_document.trim(),
      evidence_inventory: form.evidence_inventory.map(({ id, ...item }) => ({
        ...item,
        name: item.name.trim(),
        content: item.availability === 'provided' ? item.content : '',
      })),
    };

    if (
      ![payload.title, payload.category, payload.summary, payload.full_document].every(Boolean) ||
      payload.evidence_inventory.some(item => !item.name || (item.availability === 'provided' && !item.content.trim()))
    ) {
      setError('Điền đầy đủ thông tin hồ sơ và nội dung của chứng cứ được cung cấp.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');
    setCreated(null);
    setNotice('');

    try {
      if (editingCaseId) {
        // Cập nhật vụ án hiện có
        const { data } = await api.put(`/v1/cases/${editingCaseId}`, payload, { timeout: 20000 });
        setNotice(`Đã cập nhật hồ sơ vụ án “${data.data.title}” thành công.`);
        setEditingCaseId(null);
        setForm(emptyCase());
        resource.reload();
        if (detail?.data?._id === editingCaseId) {
          setDetail({ data: data.data });
        }
      } else {
        // Tạo vụ án mới
        const { data } = await api.post('/v1/cases', payload, { timeout: 20000 });
        setCreated(data.data);
        setForm(emptyCase());
        setPage(1);
        resource.reload();
      }
    } catch (failure) {
      setError(
        getApiError(
          failure,
          editingCaseId
            ? 'Chưa cập nhật được vụ án. Nội dung đã nhập vẫn được giữ lại. Kiểm tra kết nối trước khi thử lại.'
            : 'Chưa xác nhận được việc tạo vụ án. Nội dung đã nhập vẫn được giữ lại. Kiểm tra danh sách vụ án trước khi thử lại.'
        )
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleDeleteCase() {
    if (!deleteTarget || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.delete(`/v1/cases/${deleteTarget._id}`, { timeout: 20000 });
      setNotice(`Đã xóa vĩnh viễn vụ án “${deleteTarget.title}” thành công.`);
      if (editingCaseId === deleteTarget._id) {
        setEditingCaseId(null);
        setForm(emptyCase());
      }
      if (detail?.data?._id === deleteTarget._id) {
        setDetail({});
      }
      setDeleteTarget(null);
      if (resource?.data?.data?.length <= 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        resource.reload();
      }
    } catch (failure) {
      setError(getApiError(failure, 'Chưa thể xóa vụ án. Vui lòng thử lại.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
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

  return (
    <>
      <header className="admin-page-heading">
        <div>
          <h1>Hồ sơ vụ án</h1>
          <p>Tạo mới, chỉnh sửa, xóa và quản lý danh mục tình huống luyện tập trong hệ thống.</p>
        </div>
      </header>

      {notice && (
        <p className="admin-notice flex items-center gap-2" role="status">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {created && (
        <p className="admin-notice" role="status">
          Đã tạo vụ án “{created.title}”. <Link to="/dashboard/setup">Chọn vụ án để luyện tập →</Link>
        </p>
      )}

      {/* Form Tạo mới hoặc Chỉnh sửa vụ án */}
      <section ref={formRef} className="admin-card" aria-labelledby="case-form-heading">
        {editingCaseId ? (
          <div className="admin-edit-banner">
            <div>
              <strong>✏️ Đang chỉnh sửa vụ án: “{form.title || 'Hồ sơ'}”</strong>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#4b6584' }}>
                Thay đổi các thông tin bên dưới và bấm "Lưu thay đổi" để cập nhật dữ liệu.
              </p>
            </div>
            <button type="button" onClick={cancelEdit}>
              Hủy chỉnh sửa
            </button>
          </div>
        ) : null}

        <h2 id="case-form-heading">{editingCaseId ? 'Chỉnh sửa vụ án' : 'Tạo vụ án'}</h2>
        <p>
          {editingCaseId
            ? 'Cập nhật tình huống đã ẩn danh. Giữ nguyên tính nhất quán của nội dung và chứng cứ viện dẫn.'
            : 'Nhập tình huống đã ẩn danh. Chỉ thêm chứng cứ có trong hồ sơ, giữ nguyên nội dung trích dẫn.'}
        </p>

        <form className="admin-case-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Tên vụ án
              <input required maxLength={200} value={form.title} onChange={e => update('title', e.target.value)} />
            </label>
            <label>
              Loại vụ án (Dân sự, Hình sự, Đất đai, Thương mại...)
              <input required maxLength={80} value={form.category} onChange={e => update('category', e.target.value)} />
            </label>
            <label>
              Tóm tắt vụ án
              <textarea required rows={4} maxLength={4000} value={form.summary} onChange={e => update('summary', e.target.value)} />
            </label>
            <label>
              Nội dung hồ sơ đầy đủ
              <textarea required rows={10} maxLength={50000} value={form.full_document} onChange={e => update('full_document', e.target.value)} />
            </label>

            <h3>Danh sách chứng cứ hồ sơ ({form.evidence_inventory.length})</h3>
            {!form.evidence_inventory.length && (
              <p>Chưa thêm chứng cứ. Bạn vẫn có thể lưu hồ sơ chỉ gồm nội dung tình huống.</p>
            )}

            {form.evidence_inventory.map((item, index) => (
              <fieldset className="admin-evidence-form" key={item.id}>
                <legend>Chứng cứ {index + 1}</legend>
                <label>
                  Tên chứng cứ {index + 1}
                  <input required maxLength={200} value={item.name} onChange={e => updateEvidence(item.id, 'name', e.target.value)} />
                </label>
                <label>
                  Trạng thái chứng cứ {index + 1}
                  <select value={item.availability} onChange={e => updateEvidence(item.id, 'availability', e.target.value)}>
                    <option value="provided">Có nội dung được cung cấp</option>
                    <option value="mentioned_only">Chỉ được nhắc đến trong hồ sơ</option>
                  </select>
                </label>
                <label>
                  Mô tả chứng cứ {index + 1}
                  <textarea rows={2} maxLength={2000} value={item.summary} onChange={e => updateEvidence(item.id, 'summary', e.target.value)} />
                </label>
                {item.availability === 'provided' && (
                  <label>
                    Nội dung chứng cứ {index + 1}
                    <textarea required rows={4} maxLength={10000} value={item.content} onChange={e => updateEvidence(item.id, 'content', e.target.value)} />
                  </label>
                )}
                <button
                  type="button"
                  className="admin-danger"
                  onClick={() => update('evidence_inventory', form.evidence_inventory.filter(evidence => evidence.id !== item.id))}
                >
                  Xóa chứng cứ {index + 1}
                </button>
              </fieldset>
            ))}

            <button
              type="button"
              disabled={form.evidence_inventory.length >= 50}
              onClick={() =>
                update('evidence_inventory', [
                  ...form.evidence_inventory,
                  { id: crypto.randomUUID(), name: '', availability: 'provided', summary: '', content: '' },
                ])
              }
            >
              + Thêm chứng cứ
            </button>

            {error && <p role="alert" style={{ color: '#b91c1c', marginTop: '12px' }}>{error}</p>}

            <div className="admin-case-actions flex items-center gap-3">
              <button type="submit">
                {busy
                  ? editingCaseId ? 'Đang lưu thay đổi…' : 'Đang tạo vụ án…'
                  : editingCaseId ? 'Lưu thay đổi vụ án' : 'Tạo vụ án'}
              </button>
              {editingCaseId && (
                <button type="button" onClick={cancelEdit} className="admin-btn-secondary">
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </section>

      {/* Danh sách vụ án hiện có với chức năng Xem, Sửa, Xóa */}
      <section className="admin-card" aria-labelledby="case-list-heading">
        <h2 id="case-list-heading">Vụ án hiện có ({resource?.data?.pagination?.total ?? '…'})</h2>
        <LoadState resource={resource}>
          {result => (
            <>
              {!result.data.length ? (
                <p>Chưa có vụ án nào trong hệ thống.</p>
              ) : (
                <ul className="admin-case-list">
                  {result.data.map(item => (
                    <li key={item._id} style={editingCaseId === item._id ? { background: '#f8faff', padding: '16px 12px', borderRadius: '8px' } : undefined}>
                      <div>
                        <strong>{item.title}</strong>
                        {editingCaseId === item._id && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>
                            (Đang sửa)
                          </span>
                        )}
                        <p>{item.category} · {item.summary}</p>
                      </div>

                      <div className="admin-case-item-actions">
                        <button type="button" onClick={() => viewCase(item._id)} title={`Xem chi tiết hồ sơ: ${item.title}`}>
                          <Eye size={15} />
                          <span>Xem hồ sơ</span>
                        </button>

                        <button
                          type="button"
                          className="admin-btn-edit"
                          onClick={() => startEdit(item)}
                          disabled={busy}
                          title={`Chỉnh sửa hồ sơ vụ án: ${item.title}`}
                        >
                          <Pencil size={15} />
                          <span>Chỉnh sửa</span>
                        </button>

                        <button
                          type="button"
                          className="admin-btn-danger"
                          onClick={() => setDeleteTarget(item)}
                          disabled={busy}
                          title={`Xóa vụ án: ${item.title}`}
                        >
                          <Trash2 size={15} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination pagination={result.pagination} onChange={setPage} />
            </>
          )}
        </LoadState>
      </section>

      {/* Chi tiết hồ sơ khi chọn "Xem hồ sơ" */}
      {(detail.loading || detail.error || detail.data) && (
        <section className="admin-card" aria-label="Chi tiết hồ sơ">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 style={{ margin: 0 }}>Xem chi tiết hồ sơ</h2>
            <button type="button" onClick={() => setDetail({})} style={{ fontSize: '12px', padding: '4px 8px' }}>
              Đóng chi tiết
            </button>
          </div>
          {detail.loading ? (
            <p role="status">Đang tải hồ sơ…</p>
          ) : detail.error ? (
            <p role="alert">{detail.error}</p>
          ) : (
            <CaseDossier key={detail.data._id} courtCase={detail.data} />
          )}
        </section>
      )}

      {/* Modal Xác nhận Xóa Vụ Án */}
      {deleteTarget && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="admin-modal-box">
            <div className="flex items-center gap-2 mb-2 text-rose-600">
              <AlertTriangle size={22} className="shrink-0" />
              <h3 id="delete-dialog-title" style={{ margin: 0, color: '#991b1b' }}>
                Xác nhận xóa hồ sơ vụ án
              </h3>
            </div>
            <p>
              Bạn có chắc chắn muốn xóa vụ án <strong>“{deleteTarget.title}”</strong> (Loại: {deleteTarget.category}) không?
            </p>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              ⚠️ Thao tác này sẽ xóa hồ sơ vĩnh viễn khỏi danh mục tình huống luyện tập. Nếu đang có phiên luyện tập diễn ra trên vụ án này, hệ thống sẽ chặn xóa để bảo vệ bài thi của người học.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteCase}
                disabled={busy}
                className="admin-btn-danger"
              >
                {busy ? 'Đang xóa…' : 'Xác nhận xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
