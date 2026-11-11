import { caseIntroduction, caseCompletenessStats, detectCaseOrigin } from '../../../../../shared/casePresentation.mjs';
import CaseDossier from '../../../components/CaseDossier';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  Check,
  CheckCircle2,
  Gavel,
  Upload,
  Sparkles,
  FileText,
  Eye,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  X,
  Layers,
  Clock,
  Lock,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, getCurrentUser, readDraft, saveDraft } from '../../../services/auth';
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
  const [originFilter, setOriginFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('system_first');
  const [casePage, setCasePage] = useState(1);
  const [casePageSize, setCasePageSize] = useState(6);
  const [deletingCaseId, setDeletingCaseId] = useState(null);
  const currentUser = getCurrentUser();
  const [uploadAsSystem, setUploadAsSystem] = useState(currentUser?.role === 'admin');

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

  const originCounts = useMemo(() => {
    let system = 0;
    let userUpload = 0;
    let mine = 0;
    for (const item of cases) {
      const origin = detectCaseOrigin(item);
      if (origin === 'user_upload') {
        userUpload += 1;
        if (currentUser?.id && item.created_by && String(item.created_by) === String(currentUser.id)) {
          mine += 1;
        }
      } else {
        system += 1;
      }
    }
    return { all: cases.length, system, user_upload: userUpload, mine };
  }, [cases, currentUser?.id]);

  const availableCategories = useMemo(() => {
    const standard = ['dân sự', 'hình sự', 'đất đai', 'hành chính', 'thương mại', 'lao động', 'hôn nhân và gia đình'];
    const map = new Map();
    for (const cat of standard) map.set(cat.toLocaleLowerCase('vi'), cat);
    for (const item of cases) {
      const raw = String(item.category || '').trim();
      if (raw) {
        const key = raw.toLocaleLowerCase('vi');
        if (!map.has(key)) map.set(key, raw);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label: label.charAt(0).toLocaleUpperCase('vi') + label.slice(1),
    }));
  }, [cases]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi');
    const filtered = cases.filter((item) => {
      const stats = caseCompletenessStats(item);
      if (originFilter === 'system' && stats.origin !== 'system') return false;
      if (originFilter === 'user_upload' && stats.origin !== 'user_upload') return false;

      if (categoryFilter !== 'all') {
        const itemCat = String(item.category || '').trim().toLocaleLowerCase('vi');
        if (itemCat !== categoryFilter) return false;
      }

      if (qualityFilter === 'full' && !stats.has_full_dossier) return false;
      if (qualityFilter === 'partial' && stats.has_full_dossier) return false;
      if (qualityFilter === 'mine') {
        const isMine = Boolean(currentUser?.id && item.created_by && String(item.created_by) === String(currentUser.id));
        if (!isMine) return false;
      }

      if (normalizedSearch) {
        const intro = caseIntroduction(item);
        const partyNames = (item.parties ?? []).map((p) => p.name || '').join(' ');
        const haystack = `${intro.title || ''} ${intro.summary || ''} ${item.title || ''} ${item.summary || ''} ${item.category || ''} ${partyNames}`.toLocaleLowerCase('vi');
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const statsA = caseCompletenessStats(a);
      const statsB = caseCompletenessStats(b);
      if (sortBy === 'system_first') {
        if (statsA.origin !== statsB.origin) {
          return statsA.origin === 'system' ? -1 : 1;
        }
        if (statsA.has_full_dossier !== statsB.has_full_dossier) {
          return statsA.has_full_dossier ? -1 : 1;
        }
        const isLongA = (statsA.total_chars || 0) >= 12000;
        const isLongB = (statsB.total_chars || 0) >= 12000;
        if (isLongA !== isLongB) {
          return isLongA ? -1 : 1;
        }
      } else if (sortBy === 'longest_dossier') {
        const charDiff = (statsB.total_chars || 0) - (statsA.total_chars || 0);
        if (charDiff !== 0) return charDiff;
      } else if (sortBy === 'most_evidence') {
        const diff = (statsB.evidence_count + statsB.timeline_count) - (statsA.evidence_count + statsA.timeline_count);
        if (diff !== 0) return diff;
      }
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [cases, originFilter, categoryFilter, qualityFilter, searchQuery, sortBy, currentUser?.id]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / casePageSize));
  const safePage = Math.min(casePage, totalPages);
  const paginatedCases = useMemo(() => {
    const start = (safePage - 1) * casePageSize;
    return filteredCases.slice(start, start + casePageSize);
  }, [filteredCases, safePage, casePageSize]);

  const hasActiveFilters = originFilter !== 'all' || categoryFilter !== 'all' || qualityFilter !== 'all' || Boolean(searchQuery.trim()) || sortBy !== 'system_first';

  function resetCaseFilters() {
    setOriginFilter('all');
    setCategoryFilter('all');
    setQualityFilter('all');
    setSearchQuery('');
    setSortBy('system_first');
    setCasePage(1);
  }

  async function handleDeleteUploadedCase(event, item) {
    event.stopPropagation();
    if (deletingCaseId) return;
    setDeletingCaseId(item._id);
    try {
      await api.delete(`/v1/cases/${item._id}`);
      setCases((prev) => prev.filter((c) => c._id !== item._id));
      if (form.case_id === item._id) {
        setSelectedCase(null);
        setForm({ ...form, case_id: '' });
      }
      setUploadState((cur) => ({ ...cur, error: '', success: `Đã xóa hồ sơ tải lên "${item.title}".` }));
    } catch (error) {
      setState((cur) => ({ ...cur, error: getApiError(error, 'Chưa thể xóa hồ sơ tải lên này.') }));
    } finally {
      setDeletingCaseId(null);
    }
  }

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20_000_000) {
      setUploadState({ loading: false, previewing: false, error: 'Tệp tải lên quá lớn (tối đa 20MB). Vui lòng chọn tệp nhỏ hơn.', success: '' });
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
          raw_text: extractedText.slice(0, 250000),
          title: cur.title || parsed?.title || '',
          category: cur.category || parsed?.category || '',
          reference_date: cur.reference_date || parsed?.reference_date || '',
        }));
        setUploadPreview(parsed);
        setUploadState({
          loading: false,
          previewing: false,
          error: '',
          success: `Đã đọc toàn văn từ tệp "${file.name}" (${Math.max(1, Math.ceil(extractedText.length / 1650))} trang). Kiểm tra tóm tắt bên dưới rồi bấm Hoàn tất & Mở hồ sơ vụ án.`,
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
        raw_text: content.slice(0, 250000),
        title: cur.title || cleanName.slice(0, 150),
      }));
      setUploadPreview(null);
      setUploadState({ loading: false, previewing: false, error: '', success: `Đã đọc tệp "${file.name}" (${Math.max(1, Math.ceil(content.length / 1650))} trang). Bấm Xem trước hồ sơ hoặc Hoàn tất & Mở hồ sơ vụ án.` });
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
        as_system: currentUser?.role === 'admin' ? uploadAsSystem : false,
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
      membership.refresh();
      setUploadState({
        loading: false,
        previewing: false,
        error: '',
        success: created.moderation_status === 'pending'
          ? `Đã tải lên hồ sơ "${created.title}". Hồ sơ đang chờ Quản trị viên kiểm duyệt chất lượng dữ liệu trước khi mở phiên tranh tụng.`
          : `Đã tạo hồ sơ vụ án "${created.title}" thành công.`,
      });
      setStep(1);
    } catch (error) {
      if (error.response?.status === 402) membership.refresh();
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
  const isSelectedCaseApproved = currentUser?.role === 'admin' || !['pending', 'rejected'].includes(selectedCase?.moderation_status);
  const canUploadMoreCases = currentUser?.role === 'admin' || membership.loading || membership.data?.canUploadCase !== false;
  const valid = ready && isSelectedCaseApproved && Boolean(form.user_court_role && eventDate) && canStart && !membership.loading && !state.submitting;
  const steps = ['Vụ án', 'Hồ sơ', 'Vai', 'Mốc tra cứu', 'Chuẩn bị'];
  const completedSteps = [Boolean(form.case_id), reviewedCase === form.case_id, Boolean(form.user_court_role), Boolean(eventDate)];
  function goStep(index) { if (index === 1) setReviewedCase(form.case_id); setStep(index); }
  const canNext = step === 0 ? ready : step === 1 ? (ready && isSelectedCaseApproved) : step === 2 ? Boolean(form.user_court_role) : step === 3 ? Boolean(eventDate) : false;
  const summary = <dl className="setup-summary"><div><dt>Vụ án</dt><dd>{ready ? caseIntroduction(selectedCase).title : 'Chưa chọn vụ án'}</dd></div><div><dt>Vai của bạn</dt><dd>{form.user_court_role ? roleLabel(form.user_court_role, selectedCase?.category, selectedCase) : 'Chưa chọn vai'}</dd></div><div><dt>Mốc tra cứu</dt><dd>{eventDate || 'Chưa chọn mốc tra cứu'}</dd></div><div><dt>Giới hạn</dt><dd>20 lượt trao đổi</dd></div></dl>;
  return <section className="practice-dashboard simulation-setup mx-auto space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">Thiết lập phiên tòa</h1><p className="mt-2 text-slate-400">Đọc hồ sơ, chọn vai và mốc tra cứu — chuẩn bị trước khi vào phòng xử án.</p><nav className="setup-step-tabs" aria-label="Các bước thiết lập">{steps.map((title, index) => <button key={title} type="button" aria-current={step === index ? 'step' : undefined} disabled={state.submitting || (index > 0 && !ready)} onClick={() => goStep(index)}>{index < step && completedSteps[index] ? <Check size={12} className="inline" aria-hidden="true" /> : index + 1} {title}</button>)}</nav></div><Link to="/guide" className="setup-guide-link flex items-center gap-2 px-4 py-2 text-sm"><CircleHelp size={16}/> Xem hướng dẫn</Link></header>
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
                {uploadOpen ? 'Đóng khung tải hồ sơ' : <><Plus size={14} /> Tải lên bản án / hồ sơ riêng</>}
              </button>
            </div>

            {uploadOpen && (
              <form onSubmit={handleUploadCase} className="setup-upload-panel" aria-label="Tải lên bản án của riêng bạn">
                <div className="setup-upload-header">
                  <div>
                    <h3 className="setup-upload-title">
                      <Sparkles size={17} /> Tải lên bản án hoặc hồ sơ vụ việc của riêng bạn
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {currentUser?.role === 'admin' || membership?.unlimitedUploads ? (
                        <span className="text-emerald-700 font-semibold">Tài khoản được tải lên không giới hạn</span>
                      ) : (membership?.freeUploadsRemaining ?? 2) > 0 ? (
                        <span>
                          Bạn còn <strong className="text-blue-700">{membership?.freeUploadsRemaining ?? 2}/2 lượt tải hồ sơ miễn phí</strong>. Sau 2 bản miễn phí sẽ tính phí (01 lượt tranh tụng/bản hoặc gói Pro).
                        </span>
                      ) : (membership?.caseCredits ?? 0) > 0 ? (
                        <span>
                          Đã dùng hết 2 lượt miễn phí · Tải thêm sẽ trừ <strong className="text-amber-700">01 lượt tranh tụng</strong> (hiện còn {membership.caseCredits} lượt).
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold">
                          Bạn đã dùng hết 2 bản hồ sơ miễn phí. Vui lòng mua thêm lượt lẻ hoặc nâng cấp gói Pro để tiếp tục tải hồ sơ riêng.
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="setup-upload-toolbar">
                    <label className={`setup-upload-file-btn ${!canUploadMoreCases ? 'opacity-50 pointer-events-none' : ''}`}>
                      <FileText size={14} />
                      <span>{uploadedFileName ? `Đã chọn: ${uploadedFileName.slice(0, 28)}` : 'Chọn tệp bản án (.pdf, .docx, .doc, .txt)'}</span>
                      <input
                        type="file"
                        disabled={!canUploadMoreCases}
                        accept=".pdf,.docx,.doc,.html,.htm,.txt,.md,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json"
                        onChange={handleFileSelect}
                        className="setup-file-input"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!canUploadMoreCases}
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
                {!canUploadMoreCases && (
                  <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Lock size={14} className="text-amber-700 shrink-0" />
                      Bạn đã sử dụng hết 2 lượt tải lên hồ sơ riêng miễn phí. Vui lòng mua thêm lượt hoặc nâng cấp gói dịch vụ để tải thêm hồ sơ.
                    </span>
                    <Link to="/pricing" className="btn-primary py-1.5 px-3 text-xs">
                      Mua lượt / Nâng cấp gói
                    </Link>
                  </div>
                )}
                <p className="setup-upload-desc">
                  Tải lên tệp bản án <strong>PDF, Word (.docx/.doc), văn bản (.txt)</strong> hoặc dán nội dung vụ việc vào ô bên dưới. Hệ thống sẽ tự động tóm tắt diễn biến, xác định các bên đương sự, lập dòng thời gian và trích xuất danh mục tài liệu, chứng cứ cho phiên tòa. <strong>Lưu ý:</strong> Hồ sơ do người dùng tải lên sẽ ở trạng thái <strong>Chờ kiểm duyệt</strong> và cần Quản trị viên phê duyệt trước khi bắt đầu phiên tòa mô phỏng.
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
                      <option value="đất đai">Đất đai</option>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="custom-case-raw-text">Nội dung bản án / hồ sơ vụ án *</label>
                    {uploadForm.raw_text.length > 0 && (
                      <span className="text-xs font-semibold text-blue-700">
                        Đã nhận {uploadForm.raw_text.length.toLocaleString('vi-VN')} ký tự (~{Math.max(1, Math.ceil(uploadForm.raw_text.length / 1650))} trang)
                      </span>
                    )}
                  </div>
                  <textarea
                    id="custom-case-raw-text"
                    rows={6}
                    required
                    placeholder="Dán toàn văn 50-80 trang hồ sơ vụ án, bản án, lời trình bày của các bên và các tài liệu chứng cứ vào đây (hoặc chọn tệp PDF/Word tối đa 20MB ở trên)..."
                    value={uploadForm.raw_text}
                    onChange={(e) => setUploadForm((cur) => ({ ...cur, raw_text: e.target.value }))}
                  />
                  {currentUser?.role === 'admin' && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={uploadAsSystem}
                        onChange={(e) => setUploadAsSystem(e.target.checked)}
                      />
                      <span>Lưu vào danh sách <strong>Vụ án chuẩn hệ thống (Của mình)</strong> thay vì Hồ sơ người dùng tải lên</span>
                    </label>
                  )}
                </div>

                {uploadPreview && (
                  <div className="setup-upload-preview" role="region" aria-label="Bản xem trước tóm tắt hồ sơ">
                    <div className="setup-upload-preview-head">
                      <strong className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> Tóm tắt hồ sơ trích xuất</strong>
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
                    disabled={!canUploadMoreCases || uploadState.loading || uploadState.previewing || uploadForm.raw_text.trim().length < 30}
                    onClick={handlePreviewCase}
                    className="setup-upload-preview-btn"
                  >
                    <Eye size={14} />
                    {uploadState.previewing ? 'Đang trích xuất hồ sơ...' : 'Xem trước hồ sơ'}
                  </button>
                  <button
                    type="submit"
                    disabled={!canUploadMoreCases || uploadState.loading || uploadState.previewing || uploadForm.raw_text.trim().length < 30}
                    className="setup-next inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                  >
                    <Sparkles size={14} />
                    {uploadState.loading ? 'Đang khởi tạo hồ sơ vụ án...' : 'Hoàn tất & Gửi kiểm duyệt'}
                  </button>
                </div>
              </form>
            )}

            {/* Thanh phân loại nguồn vụ án & Bộ lọc tìm kiếm */}
            <div className="setup-case-browser" aria-label="Phân loại và tìm kiếm vụ án">
              <div className="setup-origin-tabs" role="tablist" aria-label="Phân loại nguồn hồ sơ vụ án">
                <button
                  type="button"
                  role="tab"
                  aria-selected={originFilter === 'all'}
                  className={`setup-origin-tab ${originFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => { setOriginFilter('all'); setCasePage(1); }}
                >
                  <Layers size={15} />
                  <span>Tất cả hồ sơ</span>
                  <strong className="setup-origin-count">{originCounts.all}</strong>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={originFilter === 'system'}
                  className={`setup-origin-tab is-system-tab ${originFilter === 'system' ? 'is-active' : ''}`}
                  onClick={() => { setOriginFilter('system'); setCasePage(1); }}
                >
                  <ShieldCheck size={15} />
                  <span>Vụ án chuẩn hệ thống</span>
                  <strong className="setup-origin-count">{originCounts.system}</strong>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={originFilter === 'user_upload'}
                  className={`setup-origin-tab is-upload-tab ${originFilter === 'user_upload' ? 'is-active' : ''}`}
                  onClick={() => { setOriginFilter('user_upload'); setCasePage(1); }}
                >
                  <Upload size={15} />
                  <span>Hồ sơ người dùng tải lên</span>
                  <strong className="setup-origin-count">{originCounts.user_upload}</strong>
                </button>
              </div>

              <div className="setup-origin-explainer">
                {originFilter === 'system' ? (
                  <p>
                    <ShieldCheck size={14} />
                    <span><strong>Vụ án chuẩn của hệ thống:</strong> Đã được chuẩn hóa đầy đủ thông tin đương sự, dòng thời gian và bút lục chứng cứ, đảm bảo chất lượng chấm điểm cao nhất.</span>
                  </p>
                ) : originFilter === 'user_upload' ? (
                  <p>
                    <Upload size={14} />
                    <span><strong>Danh sách vụ án đã được tải lên:</strong> Hồ sơ do người dùng tự tải lên được phân tách riêng biệt để tránh trường hợp thiếu dữ liệu làm ảnh hưởng đến bộ vụ án chuẩn của hệ thống.</span>
                  </p>
                ) : (
                  <p>
                    <ShieldCheck size={14} />
                    <span>Hệ thống phân loại rõ <strong>Vụ án chuẩn hệ thống (Của hệ thống)</strong> và <strong>Hồ sơ người dùng tải lên</strong>. Các vụ án chuẩn được ưu tiên hiển thị đầu tiên.</span>
                  </p>
                )}
              </div>

              <div className="setup-filter-bar">
                <div className="setup-search-box">
                  <Search size={15} className="setup-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Tìm kiếm vụ án"
                    placeholder="Tìm theo tên vụ án, đương sự, tình tiết hoặc lĩnh vực..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCasePage(1); }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="setup-search-clear"
                      aria-label="Xóa từ khóa tìm kiếm"
                      onClick={() => { setSearchQuery(''); setCasePage(1); }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="setup-filter-controls">
                  <div className="setup-filter-item">
                    <label htmlFor="setup-filter-category">
                      <Filter size={12} /> Lĩnh vực
                    </label>
                    <select
                      id="setup-filter-category"
                      value={categoryFilter}
                      onChange={(e) => { setCategoryFilter(e.target.value); setCasePage(1); }}
                    >
                      <option value="all">Tất cả lĩnh vực</option>
                      {availableCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="setup-filter-item">
                    <label htmlFor="setup-filter-quality">Chất lượng dữ liệu</label>
                    <select
                      id="setup-filter-quality"
                      value={qualityFilter}
                      onChange={(e) => { setQualityFilter(e.target.value); setCasePage(1); }}
                    >
                      <option value="all">Tất cả mức dữ liệu</option>
                      <option value="full">Đầy đủ dữ liệu tranh tụng</option>
                      <option value="partial">Hồ sơ tải lên thiếu chi tiết</option>
                      {currentUser?.id && <option value="mine">Hồ sơ do tôi tải lên ({originCounts.mine})</option>}
                    </select>
                  </div>

                  <div className="setup-filter-item">
                    <label htmlFor="setup-filter-sort">Sắp xếp</label>
                    <select
                      id="setup-filter-sort"
                      value={sortBy}
                      onChange={(e) => { setSortBy(e.target.value); setCasePage(1); }}
                    >
                      <option value="system_first">Ưu tiên vụ án hệ thống</option>
                      <option value="longest_dossier">Hồ sơ toàn văn dài nhất</option>
                      <option value="newest">Mới nhất trước</option>
                      <option value="most_evidence">Nhiều chứng cứ nhất</option>
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="setup-filter-reset"
                      onClick={resetCaseFilters}
                    >
                      <RotateCcw size={13} />
                      <span>Đặt lại lọc</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {state.loading ? (
              <p role="status">Đang tải hồ sơ...</p>
            ) : (
              <div className="space-y-3">
                {!cases.length ? (
                  <p>Chưa có vụ án để lựa chọn. Bạn có thể tải lại sau.</p>
                ) : !filteredCases.length ? (
                  <div className="setup-empty-filter">
                    <p>Không tìm thấy vụ án nào khớp với bộ lọc hiện tại.</p>
                    <button type="button" onClick={resetCaseFilters} className="setup-filter-reset">
                      <RotateCcw size={14} /> Xem lại toàn bộ vụ án
                    </button>
                  </div>
                ) : (
                  paginatedCases.map((item) => {
                    const intro = caseIntroduction(item);
                    const stats = caseCompletenessStats(item);
                    const isMine = Boolean(currentUser?.id && item.created_by && String(item.created_by) === String(currentUser.id));
                    const canDelete = stats.origin === 'user_upload' && (isMine || currentUser?.role === 'admin');
                    const isSelected = form.case_id === item._id;

                    return (
                      <div key={item._id} className="setup-case-card-wrap">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setForm({ ...form, case_id: item._id })}
                          className={`setup-option setup-case-card w-full border p-4 text-left ${isSelected ? 'is-selected' : ''} ${stats.origin === 'system' ? 'is-origin-system' : 'is-origin-upload'}`}
                        >
                          <div className="setup-case-badges">
                            {stats.origin === 'system' ? (
                              <span className="setup-badge is-system-badge">
                                <ShieldCheck size={12} /> Vụ án chuẩn hệ thống
                              </span>
                            ) : (
                              <span className="setup-badge is-upload-badge">
                                <Upload size={12} /> {isMine ? 'Hồ sơ của bạn tải lên' : 'Hồ sơ người dùng tải lên'}
                              </span>
                            )}
                            <span className="setup-badge is-category-badge">{item.category}</span>
                            {stats.origin === 'user_upload' && (
                              stats.is_pending ? (
                                <span className="setup-badge is-quality-warn" title="Hồ sơ đang chờ Quản trị viên kiểm duyệt chất lượng trước khi mở tranh tụng">
                                  <Clock size={12} /> Chờ kiểm duyệt
                                </span>
                              ) : stats.is_rejected ? (
                                <span className="setup-badge is-quality-warn" title={item.moderation_note || 'Hồ sơ không đạt yêu cầu kiểm duyệt'}>
                                  <AlertTriangle size={12} /> Từ chối duyệt
                                </span>
                              ) : (
                                <span className="setup-badge is-quality-ok">
                                  <ShieldCheck size={12} /> Đã kiểm duyệt
                                </span>
                              )
                            )}
                            {stats.origin === 'system' ? (
                              <span className="setup-badge is-quality-ok">
                                <CheckCircle2 size={12} /> {stats.estimated_pages >= 8 ? `Hồ sơ toàn văn (~${stats.estimated_pages} trang)` : `Hồ sơ chuẩn (~${stats.estimated_pages} trang)`}
                              </span>
                            ) : stats.has_full_dossier ? (
                              <span className="setup-badge is-quality-ok">
                                <CheckCircle2 size={12} /> Đủ cấu trúc (~{stats.estimated_pages} trang · {stats.evidence_count} chứng cứ)
                              </span>
                            ) : (
                              <span
                                className="setup-badge is-quality-warn"
                                title={`Hồ sơ người dùng tải lên còn thiếu: ${stats.missing_fields.join(', ')}`}
                              >
                                <AlertTriangle size={12} /> Dữ liệu tóm lược (~{stats.estimated_pages} trang · {stats.evidence_count} chứng cứ)
                              </span>
                            )}
                          </div>

                          <strong className="setup-case-card-title">{intro.title}</strong>
                          <p className="mt-1 text-sm setup-case-card-summary">{intro.summary}</p>

                          <div className="setup-case-meta">
                            <span>{stats.parties_count} bên đương sự</span>
                            <span>·</span>
                            <span>{stats.evidence_count} tài liệu chứng cứ</span>
                            <span>·</span>
                            <span>{stats.timeline_count} mốc thời gian</span>
                            {item.reference_date && (
                              <>
                                <span>·</span>
                                <span>Mốc: {item.reference_date}</span>
                              </>
                            )}
                          </div>
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            className="setup-case-delete-btn"
                            disabled={deletingCaseId === item._id}
                            title={`Xóa hồ sơ tải lên: ${intro.title}`}
                            onClick={(e) => handleDeleteUploadedCase(e, item)}
                          >
                            <Trash2 size={13} />
                            <span>{deletingCaseId === item._id ? 'Đang xóa...' : 'Xóa hồ sơ tải lên'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}

                {filteredCases.length > 0 && (
                  <nav className="setup-pagination" aria-label="Phân trang danh sách vụ án">
                    <div className="setup-pagination-info">
                      <span>
                        Hiển thị <strong>{(safePage - 1) * casePageSize + 1}–{Math.min(safePage * casePageSize, filteredCases.length)}</strong> trong tổng số <strong>{filteredCases.length}</strong> vụ án
                      </span>
                      <label className="setup-page-size">
                        <span>Hiển thị:</span>
                        <select
                          aria-label="Số vụ án mỗi trang"
                          value={casePageSize}
                          onChange={(e) => { setCasePageSize(Number(e.target.value)); setCasePage(1); }}
                        >
                          <option value={6}>6 / trang</option>
                          <option value={10}>10 / trang</option>
                          <option value={20}>20 / trang</option>
                        </select>
                      </label>
                    </div>

                    {totalPages > 1 && (
                      <div className="setup-pagination-controls">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setCasePage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft size={14} /> Trước
                        </button>
                        <div className="setup-pagination-pages">
                          {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                            .reduce((acc, p, idx, arr) => {
                              if (idx > 0 && p - arr[idx - 1] > 1) acc.push(`ellipsis-${p}`);
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((item) =>
                              typeof item === 'string' ? (
                                <span key={item} className="setup-pagination-ellipsis">…</span>
                              ) : (
                                <button
                                  key={item}
                                  type="button"
                                  aria-current={safePage === item ? 'page' : undefined}
                                  className={safePage === item ? 'is-active' : ''}
                                  onClick={() => setCasePage(item)}
                                >
                                  {item}
                                </button>
                              )
                            )}
                        </div>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => setCasePage((p) => Math.min(totalPages, p + 1))}
                        >
                          Sau <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </nav>
                )}
              </div>
            )}
            {form.case_id && !ready && <p className="mt-4" role={detailError ? 'alert' : 'status'}>{detailError || 'Đang tải chi tiết hồ sơ…'}{detailError && <button onClick={() => setReload(n => n + 1)} className="ml-2 underline">Thử lại</button>}</p>}
          </>}
          {step === 1 && (
            <>
              {!isSelectedCaseApproved && (
                <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong className="flex items-center gap-1.5 font-bold">
                    <Clock size={16} />
                    {selectedCase?.moderation_status === 'rejected'
                      ? 'Hồ sơ tải lên này đã bị từ chối kiểm duyệt'
                      : 'Hồ sơ tải lên này đang chờ Quản trị viên kiểm duyệt'}
                  </strong>
                  <p className="mt-1 text-xs">
                    {selectedCase?.moderation_status === 'rejected'
                      ? (selectedCase?.moderation_note || 'Hồ sơ không đủ dữ liệu chuẩn để tổ chức phiên tranh tụng. Vui lòng chọn một vụ án chuẩn của hệ thống.')
                      : 'Bạn có thể đọc trước cấu trúc hồ sơ vừa tải lên bên dưới. Sau khi Quản trị viên phê duyệt chất lượng dữ liệu, bạn sẽ có thể chọn vai và bắt đầu phiên tòa với hồ sơ này.'}
                  </p>
                </div>
              )}
              <CaseDossier key={form.case_id} tabbed courtCase={selectedCase} role={form.user_court_role} />
            </>
          )}
          {step === 2 && <><p className="setup-step-description">Chọn phía bạn bảo vệ; AI đảm nhiệm Chủ tọa và bên còn lại.</p><div className="grid gap-3 md:grid-cols-2">{roles.map(role => <button key={role.id} aria-label={roleLabel(role.id, selectedCase?.category, selectedCase)} aria-pressed={form.user_court_role === role.id} onClick={() => setForm({ ...form, user_court_role: role.id })} className={`setup-option setup-role border p-5 text-left ${form.user_court_role === role.id ? 'is-selected' : ''}`}><strong>{roleLabel(role.id, selectedCase?.category, selectedCase)}</strong><p>Đọc yêu cầu, liên hệ tình tiết và chứng cứ để bảo vệ quan điểm của thân chủ.</p>{selectedCase?.parties?.filter(party => party.side === (role.id === 'defense_lawyer' ? 'defendant' : 'plaintiff')).map((party, index) => <div className="setup-role-party" key={index}><b>{party.name}</b>{party.claims?.map((claim, i) => <p key={i}>{claim}</p>)}</div>)}<span className="inline-flex items-center gap-1.5">{form.user_court_role === role.id ? <><CheckCircle2 size={13} /> Đã chọn vai</> : 'Chọn vai này'}</span></button>)}</div></>}
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
