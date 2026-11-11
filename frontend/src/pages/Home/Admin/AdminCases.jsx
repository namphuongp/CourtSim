import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Eye,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Search,
  RotateCcw,
  Layers,
  Clock,
  Check,
  XCircle,
} from 'lucide-react';
import api, { getApiError } from '../../../services/api';
import CaseDossier from '../../../components/CaseDossier';
import { caseCompletenessStats, detectCaseOrigin } from '../../../../../shared/casePresentation.mjs';
import { useAdminData } from './adminData';
import { LoadState, Pagination } from './AdminElements';

const emptyCase = () => ({ title: '', category: 'dân sự', origin: 'system', summary: '', full_document: '', evidence_inventory: [] });

export default function AdminCases() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [originFilter, setOriginFilter] = useState('all');
  const [moderationFilter, setModerationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryParams = new URLSearchParams({ limit: String(limit), page: String(page) });
  if (originFilter !== 'all') queryParams.set('origin', originFilter);
  if (moderationFilter !== 'all') queryParams.set('moderation_status', moderationFilter);
  if (categoryFilter !== 'all') queryParams.set('category', categoryFilter);
  if (searchQuery.trim()) queryParams.set('q', searchQuery.trim().slice(0, 120));

  const resource = useAdminData(`/v1/cases?${queryParams.toString()}`);
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
        origin: caseData.origin || 'system',
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

  async function toggleCaseOrigin(item) {
    if (lock.current) return;
    const currentOrigin = detectCaseOrigin(item);
    const nextOrigin = currentOrigin === 'system' ? 'user_upload' : 'system';
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.patch(`/v1/cases/${item._id}/origin`, { origin: nextOrigin });
      setNotice(
        nextOrigin === 'system'
          ? `Đã chuyển “${item.title}” vào danh sách Vụ án chuẩn hệ thống (Của mình).`
          : `Đã chuyển “${item.title}” sang danh sách Hồ sơ người dùng tải lên.`
      );
      resource.reload();
    } catch (failure) {
      setError(getApiError(failure, 'Chưa thể cập nhật phân loại nguồn vụ án.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleModerateCase(item, moderationStatus) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.patch(`/v1/cases/${item._id}/moderation`, {
        moderation_status: moderationStatus,
        moderation_note:
          moderationStatus === 'rejected'
            ? 'Hồ sơ chưa đầy đủ dữ liệu hoặc chưa đạt tiêu chuẩn kiểm duyệt của hệ thống.'
            : 'Đã được Quản trị viên kiểm duyệt.',
      });
      setNotice(
        moderationStatus === 'approved'
          ? `Đã phê duyệt hồ sơ “${item.title}”. Người dùng hiện có thể mở phiên tranh tụng.`
          : `Đã từ chối phê duyệt hồ sơ “${item.title}”.`
      );
      resource.reload();
    } catch (failure) {
      setError(getApiError(failure, 'Chưa thể cập nhật trạng thái kiểm duyệt hồ sơ.'));
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
              <strong className="inline-flex items-center gap-1.5">
                <Pencil size={15} /> Đang chỉnh sửa vụ án: “{form.title || 'Hồ sơ'}”
              </strong>
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
            {editingCaseId && (
              <label>
                Phân loại nguồn vụ án
                <select value={form.origin || 'system'} onChange={e => update('origin', e.target.value)}>
                  <option value="system">Vụ án chuẩn hệ thống (Đã kiểm duyệt của hệ thống)</option>
                  <option value="user_upload">Hồ sơ do người dùng tải lên</option>
                </select>
              </label>
            )}
            <label>
              Tóm tắt vụ án
              <textarea required rows={4} maxLength={4000} value={form.summary} onChange={e => update('summary', e.target.value)} />
            </label>
            <label>
              Nội dung hồ sơ đầy đủ {form.full_document ? `(${form.full_document.length.toLocaleString('vi-VN')} ký tự · ~${Math.max(1, Math.ceil(form.full_document.length / 1650))} trang)` : ''}
              <textarea required rows={10} maxLength={250000} value={form.full_document} onChange={e => update('full_document', e.target.value)} />
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
              <Plus size={14} className="inline mr-1" /> Thêm chứng cứ
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

      {/* Danh sách vụ án hiện có với bộ lọc Nguồn, Tìm kiếm, Lĩnh vực và Phân trang */}
      <section className="admin-card" aria-labelledby="case-list-heading">
        <div className="admin-case-list-header">
          <div>
            <h2 id="case-list-heading" style={{ marginBottom: '4px' }}>
              Vụ án hiện có ({resource?.data?.pagination?.total ?? '…'})
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Phân loại giữa <strong>Vụ án chuẩn hệ thống (Của mình)</strong> và <strong>Hồ sơ người dùng tải lên</strong> để kiểm soát chất lượng dữ liệu.
            </p>
          </div>

          <div className="admin-origin-tabs" role="tablist" aria-label="Phân loại nguồn vụ án">
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'all'}
              className={originFilter === 'all' ? 'is-active' : ''}
              onClick={() => { setOriginFilter('all'); setPage(1); }}
            >
              <Layers size={14} /> Tất cả nguồn
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'system'}
              className={originFilter === 'system' ? 'is-active is-system' : ''}
              onClick={() => { setOriginFilter('system'); setPage(1); }}
            >
              <ShieldCheck size={14} /> Vụ án chuẩn hệ thống
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'user_upload'}
              className={originFilter === 'user_upload' ? 'is-active is-upload' : ''}
              onClick={() => { setOriginFilter('user_upload'); setPage(1); }}
            >
              <Upload size={14} /> Người dùng tải lên
            </button>
          </div>
        </div>

        <div className="admin-filters admin-case-filters" role="search" aria-label="Bộ lọc tìm kiếm vụ án">
          <label style={{ flex: '1 1 260px' }}>
            Tìm kiếm vụ án
            <div className="admin-search-input-wrap">
              <Search size={14} className="admin-search-icon" />
              <input
                type="search"
                placeholder="Nhập tên vụ án, đương sự hoặc nội dung tóm tắt..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-search-clear"
                  aria-label="Xóa từ khóa"
                  onClick={() => { setSearchQuery(''); setPage(1); }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </label>

          <label>
            Lĩnh vực
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="all">Tất cả lĩnh vực</option>
              <option value="dân sự">Dân sự</option>
              <option value="hình sự">Hình sự</option>
              <option value="đất đai">Đất đai</option>
              <option value="hành chính">Hành chính</option>
              <option value="thương mại">Thương mại</option>
              <option value="lao động">Lao động</option>
              <option value="hôn nhân và gia đình">Hôn nhân và gia đình</option>
            </select>
          </label>

          <label>
            Trạng thái kiểm duyệt
            <select
              value={moderationFilter}
              onChange={(e) => { setModerationFilter(e.target.value); setPage(1); }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ kiểm duyệt</option>
              <option value="approved">Đã kiểm duyệt</option>
              <option value="rejected">Từ chối duyệt</option>
            </select>
          </label>

          <label>
            Số dòng / trang
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10 vụ án</option>
              <option value={20}>20 vụ án</option>
              <option value={50}>50 vụ án</option>
            </select>
          </label>

          {(originFilter !== 'all' || moderationFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setOriginFilter('all');
                setModerationFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
                setPage(1);
              }}
            >
              <RotateCcw size={13} className="inline mr-1" /> Đặt lại lọc
            </button>
          )}
        </div>

        <LoadState resource={resource}>
          {result => (
            <>
              {!result.data.length ? (
                <p className="admin-empty">Không có vụ án nào phù hợp với bộ lọc hiện tại.</p>
              ) : (
                <ul className="admin-case-list">
                  {result.data.map(item => {
                    const stats = caseCompletenessStats(item);
                    return (
                      <li key={item._id} style={editingCaseId === item._id ? { background: '#f8faff', padding: '16px 12px', borderRadius: '8px' } : undefined}>
                        <div>
                          <div className="admin-case-badges">
                            {stats.origin === 'system' ? (
                              <span className="admin-badge admin-ok inline-flex items-center gap-1">
                                <ShieldCheck size={12} /> Vụ án chuẩn hệ thống
                              </span>
                            ) : (
                              <span className="admin-badge admin-upload-badge inline-flex items-center gap-1">
                                <Upload size={12} /> Người dùng tải lên
                              </span>
                            )}
                            {stats.is_pending ? (
                              <span className="admin-badge admin-warning inline-flex items-center gap-1">
                                <Clock size={12} /> Chờ kiểm duyệt
                              </span>
                            ) : stats.is_rejected ? (
                              <span className="admin-badge admin-danger inline-flex items-center gap-1">
                                <XCircle size={12} /> Từ chối duyệt
                              </span>
                            ) : (
                              <span className="admin-badge admin-ok inline-flex items-center gap-1">
                                <CheckCircle2 size={12} /> Đã duyệt
                              </span>
                            )}
                            <span className="admin-badge">{item.category}</span>
                            {stats.origin === 'user_upload' && !stats.has_full_dossier ? (
                              <span
                                className="admin-badge admin-warning inline-flex items-center gap-1"
                                title={`Thiếu: ${stats.missing_fields.join(', ')}`}
                              >
                                <AlertTriangle size={12} /> Dữ liệu tóm lược (~{stats.estimated_pages} trang · {stats.evidence_count} chứng cứ)
                              </span>
                            ) : (
                              <span className="admin-badge">
                                ~{stats.estimated_pages} trang · {stats.parties_count} đương sự · {stats.evidence_count} chứng cứ · {stats.timeline_count} mốc thời gian
                              </span>
                            )}
                          </div>

                          <strong>{item.title}</strong>
                          {editingCaseId === item._id && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>
                              (Đang sửa)
                            </span>
                          )}
                          <p>{item.summary}</p>
                        </div>

                        <div className="admin-case-item-actions">
                          {stats.moderation_status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleModerateCase(item, 'approved')}
                              disabled={busy}
                              style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#047857', fontWeight: 700 }}
                              title="Phê duyệt hồ sơ này để cho phép người học bắt đầu phiên tòa mô phỏng"
                            >
                              <Check size={15} />
                              <span>Duyệt hồ sơ</span>
                            </button>
                          )}
                          {stats.origin === 'user_upload' && stats.moderation_status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleModerateCase(item, 'rejected')}
                              disabled={busy}
                              style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#b45309' }}
                              title="Từ chối phê duyệt hồ sơ này"
                            >
                              <XCircle size={15} />
                              <span>Từ chối</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleCaseOrigin(item)}
                            disabled={busy}
                            title={stats.origin === 'system' ? 'Chuyển sang Hồ sơ người dùng tải lên' : 'Đánh dấu là Vụ án chuẩn của hệ thống (Của mình)'}
                          >
                            {stats.origin === 'system' ? <Upload size={15} /> : <ShieldCheck size={15} />}
                            <span>{stats.origin === 'system' ? 'Sang tải lên' : 'Đặt làm chuẩn'}</span>
                          </button>

                          <button
                            type="button"
                            aria-label={`Xem hồ sơ: ${item.title}`}
                            onClick={() => viewCase(item._id)}
                            title={`Xem chi tiết hồ sơ: ${item.title}`}
                          >
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
                    );
                  })}
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
            <p className="flex items-start gap-1.5" style={{ fontSize: '13px', color: '#64748b' }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span>Thao tác này sẽ xóa hồ sơ vĩnh viễn khỏi danh mục tình huống luyện tập. Nếu đang có phiên luyện tập diễn ra trên vụ án này, hệ thống sẽ chặn xóa để bảo vệ bài thi của người học.</span>
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
