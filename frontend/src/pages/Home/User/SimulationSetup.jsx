import { caseIntroduction } from '../../../../../shared/casePresentation.mjs';
import CaseDossier from '../../../components/CaseDossier';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, CheckCircle2, Gavel, Upload, Sparkles, FileText, Eye } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';
import '../../../components/dashboard/dashboard.css';
import useMembership from '../../../components/membership/useMembership';
import MembershipSummary from '../../../components/membership/MembershipSummary';

const roles = [
  { id: 'defense_lawyer', label: 'Luật sư bảo vệ bị đơn/bị cáo' },
  { id: 'plaintiff_lawyer', label: 'Luật sư bảo vệ nguyên đơn/người bị hại' },
];

const SAMPLE_UPLOAD_TEXT = [
  'BẢN ÁN DÂN SỰ SƠ THẨM SỐ 18/2026/DS-ST NGÀY 10/06/2026',
  'Về việc: Tranh chấp hợp đồng thuê mặt bằng kinh doanh và bồi thường thiệt hại.',
  'Nguyên đơn là bà Lê Hoàng Yến khởi kiện yêu cầu Công ty TNHH Thương mại Minh Phát hoàn trả 120.000.000 đồng tiền đặt cọc thuê mặt bằng và bồi thường 30.000.000 đồng chi phí cải tạo mặt bằng.',
  'Bị đơn là Công ty TNHH Thương mại Minh Phát không đồng ý trả lại tiền cọc và cho rằng bà Yến tự ý chấm dứt hợp đồng trước thời hạn mà không báo trước đủ 30 ngày theo thỏa thuận.',
  'Ngày 05/01/2026, hai bên ký Hợp đồng thuê mặt bằng số 05/HĐMB-2026 tại Quận 3, thời hạn thuê 24 tháng, tiền đặt cọc 120.000.000 đồng đã chuyển khoản qua ngân hàng.',
  'Ngày 18/03/2026, hệ thống cấp thoát nước tại mặt bằng bị sự cố ngập úng nghiêm trọng, bà Yến lập Biên bản hiện trạng sự cố ngập úng có xác nhận của Tổ trưởng dân phố và gửi thông báo đề nghị Công ty Minh Phát sửa chữa.',
  'Ngày 02/04/2026, do mặt bằng vẫn không thể kinh doanh sau 15 ngày chờ đợi, bà Lê Hoàng Yến gửi Thông báo chấm dứt hợp đồng thuê mặt bằng và yêu cầu hoàn trả tiền đặt cọc nhưng Công ty Minh Phát từ chối.',
].join('\n');

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export default function SimulationSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [reviewedCase, setReviewedCase] = useState(null);
  const [cases, setCases] = useState([]);
  const storageKey = draftKey('setup');
  const [form, updateForm] = useState(() => {
    const saved = readDraft(storageKey);
    // Bản nháp cũ không được âm thầm giữ mức phản biện đã bỏ khỏi giao diện.
    const requestedCase = params.get('case');
    const changesCase = requestedCase && requestedCase !== saved?.case_id;
    return { case_id: '', user_court_role: '', case_event_date: '', ...saved, ...(requestedCase ? { case_id: requestedCase } : {}), difficulty: 'balanced', request_id: !changesCase && saved?.difficulty === 'balanced' && saved.request_id ? saved.request_id : crypto.randomUUID() };
  });
  const setForm = (value) => updateForm({ ...value, request_id: crypto.randomUUID() });
  const membership = useMembership(form.request_id);
  const canResume = membership.data?.resumeRequestId === form.request_id;
  const canStart = membership.data?.canCreateSession || canResume;
  const busy = useRef(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [reload, setReload] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadForm, setUploadForm] = useState({ raw_text: '', title: '', category: '', reference_date: '' });
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadState, setUploadState] = useState({ loading: false, previewing: false, error: '', success: '' });

  useEffect(() => { saveDraft(storageKey, form); }, [storageKey, form]);
  useEffect(() => {
    let active = true;
    if (form.case_id) api.get(`/v1/cases/${form.case_id}`).then(({ data }) => { if (active) { setSelectedCase(data.data); setDetailError(''); } }).catch((e) => { if (active) setDetailError(getApiError(e)); });
    return () => { active = false; };
  }, [form.case_id, reload]);
  const [state, setState] = useState({ loading: true, submitting: false, error: '' });

  useEffect(() => {
    let active = true;
    async function loadCases() {
      const { data } = await api.get('/v1/cases?limit=50');
      const items = [...data.data];
      for (let page = 2; items.length < data.pagination.total; page += 1) {
        const response = await api.get(`/v1/cases?limit=50&page=${page}`);
        if (!response.data.data.length) break;
        items.push(...response.data.data);
      }
      return items;
    }
    loadCases().then((items) => {
      if (!active) return;
      setCases(items);
      setState((current) => ({ ...current, loading: false }));
    }).catch((error) => { if (active) setState({ loading: false, submitting: false, error: getApiError(error) }); });
    return () => { active = false; };
  }, [reload]);

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setUploadState({ loading: false, previewing: false, error: 'Tệp tải lên quá lớn (tối đa 5MB). Vui lòng chọn tệp nhỏ hơn.', success: '' });
      return;
    }
    setUploadedFileName(file.name);
    const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1] ?? '';
    const isBinaryDoc = ['pdf', 'doc', 'docx', 'html', 'htm'].includes(ext);

    if (isBinaryDoc) {
      setUploadState({ loading: false, previewing: true, error: '', success: '' });
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { data } = await api.post('/v1/cases/upload-parse', {
          file_name: file.name,
          file_base64: dataUrl,
          title: uploadForm.title.trim() || undefined,
          category: uploadForm.category.trim() || undefined,
          reference_date: uploadForm.reference_date || undefined,
          save: false,
        });
        const parsed = data.parsed || data.data;
        const extractedText = data.extracted_text || parsed?.full_document || '';
        setUploadForm((cur) => ({
          raw_text: extractedText.slice(0, 45000),
          title: cur.title || parsed?.title || '',
          category: cur.category || parsed?.category || '',
          reference_date: cur.reference_date || parsed?.reference_date || '',
        }));
        setUploadPreview(parsed);
        setUploadState({
          loading: false,
          previewing: false,
          error: '',
          success: `Đã đọc nội dung từ tệp "${file.name}". Kiểm tra tóm tắt hồ sơ bên dưới rồi bấm Hoàn tất & Mở hồ sơ vụ án.`,
        });
      } catch (error) {
        setUploadState({
          loading: false,
          previewing: false,
          error: getApiError(error, 'Không thể đọc nội dung từ tệp đã chọn. Vui lòng dán trực tiếp văn bản bản án vào ô bên dưới.'),
          success: '',
        });
      }
      return;
    }

    try {
      const content = await file.text();
      const cleanName = file.name.replace(/\.[^.]+$/u, '').replace(/[_-]+/gu, ' ').trim();
      setUploadForm((cur) => ({
        ...cur,
        raw_text: content.slice(0, 45000),
        title: cur.title || cleanName.slice(0, 150),
      }));
      setUploadPreview(null);
      setUploadState({ loading: false, previewing: false, error: '', success: `Đã đọc tệp "${file.name}". Bấm Xem trước hồ sơ hoặc Hoàn tất & Mở hồ sơ vụ án.` });
    } catch {
      setUploadState({ loading: false, previewing: false, error: 'Không thể đọc tệp đã chọn. Vui lòng dán trực tiếp nội dung bản án vào ô bên dưới.', success: '' });
    }
  }

  async function handlePreviewCase() {
    if (uploadState.loading || uploadState.previewing || uploadForm.raw_text.trim().length < 30) return;
    setUploadState({ loading: false, previewing: true, error: '', success: '' });
    try {
      const { data } = await api.post('/v1/cases/upload-parse', {
        raw_text: uploadForm.raw_text,
        title: uploadForm.title.trim() || undefined,
        category: uploadForm.category.trim() || undefined,
        reference_date: uploadForm.reference_date || undefined,
        save: false,
      });
      const parsed = data.parsed || data.data;
      setUploadPreview(parsed);
      setUploadForm((cur) => ({
        ...cur,
        title: cur.title || parsed?.title || '',
        category: cur.category || parsed?.category || '',
        reference_date: cur.reference_date || parsed?.reference_date || '',
      }));
      setUploadState({ loading: false, previewing: false, error: '', success: '' });
    } catch (error) {
      setUploadState({
        loading: false,
        previewing: false,
        error: getApiError(error, 'Chưa thể tóm tắt hồ sơ bản án. Vui lòng kiểm tra lại nội dung.'),
        success: '',
      });
    }
  }

  async function handleUploadCase(event) {
    event.preventDefault();
    if (uploadState.loading || uploadState.previewing || !uploadForm.raw_text.trim()) return;
    setUploadState({ loading: true, previewing: false, error: '', success: '' });
    try {
      const { data } = await api.post('/v1/cases/upload-parse', {
        raw_text: uploadForm.raw_text,
        title: uploadForm.title.trim() || undefined,
        category: uploadForm.category.trim() || undefined,
        reference_date: uploadForm.reference_date || undefined,
        save: true,
      });
      const created = data.data;
      setCases((prev) => [created, ...prev.filter((item) => item._id !== created._id)]);
      setSelectedCase(created);
      setDetailError('');
      setForm({
        ...form,
        case_id: created._id,
        case_event_date: created.reference_date || form.case_event_date,
      });
      setReviewedCase(created._id);
      setUploadOpen(false);
      setUploadPreview(null);
      setUploadedFileName('');
      setUploadForm({ raw_text: '', title: '', category: '', reference_date: '' });
      setUploadState({
        loading: false,
        previewing: false,
        error: '',
        success: `Đã tạo hồ sơ vụ án "${created.title}" thành công.`,
      });
      setStep(1);
    } catch (error) {
      setUploadState({
        loading: false,
        previewing: false,
        error: getApiError(error, 'Chưa thể xử lý bản án tải lên. Vui lòng kiểm tra lại nội dung.'),
        success: '',
      });
    }
  }

  const fixedDate = selectedCase?._id === form.case_id ? selectedCase.reference_date : null;
  const eventDate = fixedDate || form.case_event_date;

  async function startSession() {
    if (busy.current || selectedCase?._id !== form.case_id || !form.user_court_role || !eventDate || detailError || !canStart || membership.loading) return;
    busy.current = true;
    setState((current) => ({ ...current, submitting: true, error: '' }));
    try {
      const { data } = await api.post('/v1/sessions', { ...form, case_event_date: eventDate });
      saveDraft(storageKey, null);
      navigate(`/simulation/${data.data.session._id}`);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: getApiError(error, 'Chưa thể bắt đầu phiên. Lựa chọn của bạn vẫn được giữ lại. Vui lòng thử lại.') }));
      busy.current = false;
      if (error.response?.status === 402) membership.refresh();
    }
  }

  const ready = selectedCase?._id === form.case_id && !detailError;
  const valid = ready && Boolean(form.user_court_role && eventDate) && canStart && !membership.loading && !state.submitting;
  const steps = ['Vụ án', 'Hồ sơ', 'Vai', 'Mốc tra cứu', 'Chuẩn bị'];
  const completedSteps = [Boolean(form.case_id), reviewedCase === form.case_id, Boolean(form.user_court_role), Boolean(eventDate)];
  function goStep(index) { if (index === 1) setReviewedCase(form.case_id); setStep(index); }
  const canNext = step === 0 ? ready : step === 1 ? ready : step === 2 ? Boolean(form.user_court_role) : step === 3 ? Boolean(eventDate) : false;
  const summary = <dl className="setup-summary"><div><dt>Vụ án</dt><dd>{ready ? caseIntroduction(selectedCase).title : 'Chưa chọn vụ án'}</dd></div><div><dt>Vai của bạn</dt><dd>{form.user_court_role ? roleLabel(form.user_court_role, selectedCase?.category, selectedCase) : 'Chưa chọn vai'}</dd></div><div><dt>Mốc tra cứu</dt><dd>{eventDate || 'Chưa chọn mốc tra cứu'}</dd></div><div><dt>Giới hạn</dt><dd>20 lượt trao đổi</dd></div></dl>;
  return <section className="practice-dashboard simulation-setup mx-auto space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">Thiết lập phiên tòa</h1><p className="mt-2 text-slate-400">Đọc hồ sơ, chọn vai và mốc tra cứu — chuẩn bị trước khi vào phòng xử án.</p><nav className="setup-step-tabs" aria-label="Các bước thiết lập">{steps.map((title, index) => <button key={title} type="button" aria-current={step === index ? 'step' : undefined} disabled={state.submitting || (index > 0 && !ready)} onClick={() => goStep(index)}>{index < step && completedSteps[index] ? '✓' : index + 1} {title}</button>)}</nav></div><Link to="/guide" className="setup-guide-link flex items-center gap-2 px-4 py-2 text-sm"><CircleHelp size={16}/> Xem hướng dẫn</Link></header>
    {state.error && <p role="alert" className="dashboard-card dashboard-alert">{state.error} <button className="underline" onClick={() => setReload(n => n + 1)}>Thử lại</button></p>}
    {uploadState.success && <p role="status" className="dashboard-card setup-upload-success p-3.5 text-sm">{uploadState.success}</p>}
    <fieldset disabled={state.submitting} className="setup-grid grid gap-6 lg:grid-cols-3">
      <div className="setup-step-content lg:col-span-2">
        <article className="setup-card p-6">
          <h2 className="setup-step-title"><span>{step + 1}</span>{['Chọn vụ án', 'Hồ sơ vụ án', 'Chọn vai của bạn', 'Mốc tra cứu pháp luật', 'Chuẩn bị & sẵn sàng'][step]}</h2>
          {step === 0 && <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="setup-step-description !mb-0">Đọc tóm tắt và chọn tình huống bạn muốn thực hành hoặc tải lên bản án của riêng bạn.</p>
              <button
                type="button"
                className="setup-upload-trigger"
                aria-expanded={uploadOpen}
                onClick={() => setUploadOpen((v) => !v)}
              >
                <Upload size={15} />
                {uploadOpen ? 'Đóng khung tải hồ sơ' : '＋ Tải lên bản án / hồ sơ riêng'}
              </button>
            </div>

            {uploadOpen && (
              <form onSubmit={handleUploadCase} className="setup-upload-panel" aria-label="Tải lên bản án của riêng bạn">
                <div className="setup-upload-header">
                  <h3 className="setup-upload-title">
                    <Sparkles size={17} /> Tải lên bản án hoặc hồ sơ vụ việc của riêng bạn
                  </h3>
                  <div className="setup-upload-toolbar">
                    <label className="setup-upload-file-btn">
                      <FileText size={14} />
                      <span>{uploadedFileName ? `Đã chọn: ${uploadedFileName.slice(0, 28)}` : 'Chọn tệp bản án (.pdf, .docx, .doc, .txt)'}</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.html,.htm,.txt,.md,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json"
                        onChange={handleFileSelect}
                        className="setup-file-input"
                      />
                    </label>
                    <button
                      type="button"
                      className="setup-upload-sample-btn"
                      onClick={() => {
                        setUploadPreview(null);
                        setUploadedFileName('');
                        setUploadForm({
                          raw_text: SAMPLE_UPLOAD_TEXT,
                          title: 'Vụ án tranh chấp hợp đồng thuê mặt bằng giữa bà Lê Hoàng Yến và Công ty Minh Phát',
                          category: 'dân sự',
                          reference_date: '2026-04-02',
                        });
                      }}
                    >
                      Điền mẫu bản án tham khảo
                    </button>
                  </div>
                </div>
                <p className="setup-upload-desc">
                  Tải lên tệp bản án <strong>PDF, Word (.docx/.doc), văn bản (.txt)</strong> hoặc dán nội dung vụ việc vào ô bên dưới. Hệ thống sẽ tự động tóm tắt diễn biến, xác định các bên đương sự, lập dòng thời gian và trích xuất danh mục tài liệu, chứng cứ cho phiên tòa.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="upload-case-title">Tên vụ án (tùy chọn)</label>
                    <input
                      id="upload-case-title"
                      type="text"
                      maxLength={190}
                      placeholder="Để trống hệ thống sẽ tự đặt tên..."
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm((cur) => ({ ...cur, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="upload-case-category">Lĩnh vực (tùy chọn)</label>
                    <select
                      id="upload-case-category"
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm((cur) => ({ ...cur, category: e.target.value }))}
                    >
                      <option value="">Tự động xác định theo nội dung</option>
                      <option value="dân sự">Dân sự</option>
                      <option value="hình sự">Hình sự</option>
                      <option value="lao động">Lao động</option>
                      <option value="thương mại">Kinh doanh - Thương mại</option>
                      <option value="hành chính">Hành chính</option>
                      <option value="hôn nhân và gia đình">Hôn nhân và gia đình</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="upload-case-date">Mốc ngày sự kiện / xét xử (tùy chọn)</label>
                    <input
                      id="upload-case-date"
                      type="date"
                      value={uploadForm.reference_date}
                      onChange={(e) => setUploadForm((cur) => ({ ...cur, reference_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label htmlFor="custom-case-raw-text">Nội dung bản án / hồ sơ vụ án *</label>
                  <textarea
                    id="custom-case-raw-text"
                    rows={6}
                    required
                    placeholder="Dán toàn văn hoặc tóm tắt nội dung bản án, lời trình bày của các bên và các tài liệu chứng cứ vào đây (hoặc chọn tệp PDF/Word ở trên)..."
                    value={uploadForm.raw_text}
                    onChange={(e) => setUploadForm((cur) => ({ ...cur, raw_text: e.target.value }))}
                  />
                </div>

                {uploadPreview && (
                  <div className="setup-upload-preview" role="region" aria-label="Bản xem trước tóm tắt hồ sơ">
                    <div className="setup-upload-preview-head">
                      <strong>✓ Tóm tắt hồ sơ trích xuất</strong>
                      <span className="setup-upload-preview-badge">{uploadPreview.category} · Mốc tra cứu: {uploadPreview.reference_date}</span>
                    </div>
                    <p className="setup-upload-preview-title"><strong>Tên vụ án:</strong> {uploadPreview.title}</p>
                    <div className="setup-upload-party-grid">
                      {uploadPreview.parties?.map((party, idx) => (
                        <div key={idx} className="setup-upload-party-card">
                          <strong>{party.side === 'plaintiff' ? 'Nguyên đơn / Bị hại' : 'Bị đơn / Bị cáo'}: {party.name}</strong>
                          <p>{party.claims?.[0]}</p>
                        </div>
                      ))}
                    </div>
                    <p className="setup-upload-preview-meta">
                      <strong>Hồ sơ gồm:</strong> {uploadPreview.timeline?.length || 0} mốc thời gian · {uploadPreview.evidence_inventory?.length || 0} tài liệu, chứng cứ ({uploadPreview.evidence_inventory?.map((e) => e.name).join(', ')})
                    </p>
                  </div>
                )}

                {uploadState.error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{uploadState.error}</p>}
                <div className="setup-upload-actions">
                  <button
                    type="button"
                    className="setup-upload-cancel-btn"
                    onClick={() => { setUploadOpen(false); setUploadPreview(null); setUploadedFileName(''); }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={uploadState.loading || uploadState.previewing || uploadForm.raw_text.trim().length < 30}
                    onClick={handlePreviewCase}
                    className="setup-upload-preview-btn"
                  >
                    <Eye size={14} />
                    {uploadState.previewing ? 'Đang trích xuất hồ sơ...' : 'Xem trước hồ sơ'}
                  </button>
                  <button
                    type="submit"
                    disabled={uploadState.loading || uploadState.previewing || uploadForm.raw_text.trim().length < 30}
                    className="setup-next inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                  >
                    <Sparkles size={14} />
                    {uploadState.loading ? 'Đang khởi tạo hồ sơ vụ án...' : 'Hoàn tất & Mở hồ sơ vụ án'}
                  </button>
                </div>
              </form>
            )}

            {state.loading ? <p role="status">Đang tải hồ sơ...</p> : <div className="space-y-3">{!cases.length && <p>Chưa có vụ án để lựa chọn. Bạn có thể tải lại sau.</p>}{cases.map(item => <button key={item._id} aria-pressed={form.case_id === item._id} onClick={() => setForm({ ...form, case_id: item._id })} className={`setup-option w-full border p-4 text-left ${form.case_id === item._id ? 'is-selected' : ''}`}><strong>{caseIntroduction(item).title}</strong><p className="mt-1 text-sm">{caseIntroduction(item).summary}</p><span className="mt-2 inline-block text-xs">{item.category}</span></button>)}</div>}{form.case_id && !ready && <p className="mt-4" role={detailError ? 'alert' : 'status'}>{detailError || 'Đang tải chi tiết hồ sơ…'}{detailError && <button onClick={() => setReload(n => n + 1)} className="ml-2 underline">Thử lại</button>}</p>}
          </>}
          {step === 1 && <CaseDossier key={form.case_id} tabbed courtCase={selectedCase} role={form.user_court_role} />}
          {step === 2 && <><p className="setup-step-description">Chọn phía bạn bảo vệ; AI đảm nhiệm Chủ tọa và bên còn lại.</p><div className="grid gap-3 md:grid-cols-2">{roles.map(role => <button key={role.id} aria-label={roleLabel(role.id, selectedCase?.category, selectedCase)} aria-pressed={form.user_court_role === role.id} onClick={() => setForm({ ...form, user_court_role: role.id })} className={`setup-option setup-role border p-5 text-left ${form.user_court_role === role.id ? 'is-selected' : ''}`}><strong>{roleLabel(role.id, selectedCase?.category, selectedCase)}</strong><p>Đọc yêu cầu, liên hệ tình tiết và chứng cứ để bảo vệ quan điểm của thân chủ.</p>{selectedCase?.parties?.filter(party => party.side === (role.id === 'defense_lawyer' ? 'defendant' : 'plaintiff')).map((party, index) => <div className="setup-role-party" key={index}><b>{party.name}</b>{party.claims?.map((claim, i) => <p key={i}>{claim}</p>)}</div>)}<span>{form.user_court_role === role.id ? '◉ Đã chọn vai' : '○ Chọn vai này'}</span></button>)}</div></>}
          {step === 3 && <><label htmlFor="case-event-date" className="mb-2 mt-5 block font-bold">{fixedDate ? '3. Mốc tra cứu của bài tập' : '3. Ngày sự kiện làm phát sinh tranh chấp'}</label><p className="mb-4 text-sm">{selectedCase?.practice_context ? 'Dùng ngày xét xử sơ thẩm làm mốc tham khảo khi tra cứu luật. Ngày xét xử phúc thẩm chưa được nêu trong hồ sơ.' : 'Chọn ngày xảy ra sự việc để tra cứu luật. Nếu hồ sơ không nêu rõ, bạn có thể chọn ngày giả định cho bài tập. Cần đối chiếu thời điểm áp dụng của từng quy định.'}</p><input id="case-event-date" type="date" required readOnly={Boolean(fixedDate)} value={eventDate} onChange={event => setForm({ ...form, case_event_date: event.target.value })} className="setup-date w-full rounded-lg border px-4 py-3"/><p className="setup-date-note">{selectedCase?.reference_date_note || 'Mốc tra cứu không tự xác nhận hiệu lực hay điều kiện áp dụng của văn bản pháp luật.'}</p></>}
          {step === 4 && <><p className="setup-step-description">Kiểm tra các lựa chọn và cách tham gia phiên trước khi bắt đầu.</p>{summary}<div className="setup-preparation"><div><BookOpen size={20}/><h3>Nắm rõ hồ sơ</h3><p>Chỉ sử dụng tình tiết và chứng cứ đã được cung cấp.</p></div><div><Gavel size={20}/><h3>Tranh luận theo lượt</h3><p>Đọc lời thoại rồi bấm Tiếp tục. Gửi lập luận khi đến lượt bạn.</p></div></div></>}
        </article>
        <nav className="setup-step-actions" aria-label="Chuyển bước thiết lập"><button type="button" disabled={step === 0} onClick={() => goStep(step - 1)}><ArrowLeft size={14}/> Quay lại</button>{step < 4 ? <button type="button" className="setup-next" disabled={!canNext} onClick={() => goStep(step + 1)}>Tiếp: {steps[step + 1]} <ArrowRight size={14}/></button> : <button type="button" className="setup-next" disabled={!valid} onClick={() => setConfirm(true)}>Bắt đầu phiên tòa <ArrowRight size={14}/></button>}</nav>
      </div>
      <aside className="setup-aside h-fit p-5 lg:sticky lg:top-32"><Gavel className="mb-3"/><h2>Sẵn sàng tranh tụng?</h2>{summary}<ul className="setup-checklist">{['Đã chọn vụ án', 'Đã đọc hồ sơ', 'Đã chọn vai', 'Đã đặt mốc tra cứu'].map((text, index) => <li key={text} className={completedSteps[index] ? 'is-done' : ''}><CheckCircle2 size={14}/>{completedSteps[index] ? text : text.replace('Đã', 'Chưa')}</li>)}</ul><MembershipSummary resource={membership}/>{canResume && <p className="my-4 text-sm">Bạn có thể tiếp tục khởi tạo phiên đã yêu cầu. Hệ thống sẽ không trừ thêm lượt.</p>}<button type="button" onClick={() => setConfirm(true)} disabled={!valid} className="setup-start w-full font-bold">{state.submitting ? 'Đang khởi tạo...' : canResume ? 'Tiếp tục khởi tạo phiên' : 'Bắt đầu phiên tòa'}</button><p className="setup-start-note">Kiểm tra thông tin trước khi xác nhận sử dụng lượt luyện tập.</p></aside>
    </fieldset>
    {confirm && <FeedbackModal title="Bắt đầu phiên luyện tập?" onClose={() => { if (!state.submitting) setConfirm(false); }}><p className="mb-5 text-sm">Kiểm tra vụ án, vai và mốc tra cứu. Lượt chỉ được sử dụng khi hệ thống khởi tạo phiên.</p>{summary}{state.error && <p role="alert" className="my-4 text-rose-600">{state.error}</p>}<div className="setup-confirm-actions"><button disabled={state.submitting} onClick={() => setConfirm(false)}>Tiếp tục chuẩn bị</button><button className="setup-next" disabled={!valid} onClick={startSession}>{state.submitting ? 'Đang khởi tạo...' : 'Xác nhận bắt đầu'}</button></div></FeedbackModal>}
  </section>;
}
