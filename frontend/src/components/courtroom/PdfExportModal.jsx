import { useEffect, useState, useMemo } from 'react';
import { 
  FileDown, 
  Printer, 
  FileText, 
  X, 
  Copy, 
  Check, 
  Award, 
  ScrollText, 
  Layers, 
  Loader2 
} from 'lucide-react';
import { getCurrentUser } from '../../services/auth';
import api from '../../services/api';
import { 
  generateCourtroomDocumentHtml, 
  exportDocumentToPdf, 
  downloadDocumentAsHtml 
} from '../../services/pdfExportService';

export default function PdfExportModal({
  open = false,
  onClose,
  sessionId,
  initialType = 'result',
  session: propSession = null,
  result: propResult = null,
  records: propRecords = null,
}) {
  const [docType, setDocType] = useState(initialType);
  const [session, setSession] = useState(propSession);
  const [result, setResult] = useState(propResult);
  const [records, setRecords] = useState(propRecords || []);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDocType(initialType);
  }, [initialType]);

  // Tự động tải dữ liệu nếu chưa có sẵn
  useEffect(() => {
    if (!open || !sessionId) return;

    let active = true;
    const needSession = !propSession;
    const needResult = !propResult;
    const needRecords = !propRecords || propRecords.length === 0;

    if (!needSession && !needResult && !needRecords) {
      setSession(propSession);
      setResult(propResult);
      setRecords(propRecords);
      return;
    }

    setLoading(true);
    const promises = [];

    if (needSession) promises.push(api.get(`/v1/sessions/${sessionId}`).then(res => ({ type: 'session', data: res.data.data })));
    if (needResult) {
      promises.push(
        api.get(`/v1/sessions/${sessionId}/result`)
          .then(res => ({ type: 'result', data: res.data.data }))
          .catch(() => ({ type: 'result', data: null }))
      );
    }
    if (needRecords) {
      promises.push(
        api.get(`/v1/sessions/${sessionId}/records`)
          .then(res => ({ type: 'records', data: res.data.data }))
          .catch(() => ({ type: 'records', data: [] }))
      );
    }

    Promise.all(promises)
      .then(responses => {
        if (!active) return;
        responses.forEach(item => {
          if (item.type === 'session') setSession(item.data);
          if (item.type === 'result') setResult(item.data);
          if (item.type === 'records') setRecords(item.data);
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [open, sessionId, propSession, propResult, propRecords]);

  const currentUser = useMemo(() => getCurrentUser(), []);

  const documentHtml = useMemo(() => {
    if (!session) return '';
    return generateCourtroomDocumentHtml({
      type: docType,
      session,
      result,
      records,
      currentUser,
    });
  }, [docType, session, result, records, currentUser]);

  if (!open) return null;

  const caseTitle = session?.case_id?.title || session?.case_snapshot?.title || 'Phiên mô phỏng';
  const filename = `${docType === 'result' ? 'Ket_Qua_Tranh_Tung' : docType === 'transcript' ? 'Bien_Ban_Phien_Toa' : 'Ho_So_Phien_Toa'}_${String(sessionId).slice(-6)}`;

  async function handlePrintPdf() {
    setExporting(true);
    try {
      await exportDocumentToPdf(documentHtml, filename);
    } finally {
      setExporting(false);
    }
  }

  function handleDownloadHtml() {
    downloadDocumentAsHtml(documentHtml, `${filename}.html`);
  }

  function handleCopyText() {
    const parser = new DOMParser();
    const doc = parser.parseFromString(documentHtml, 'text/html');
    const text = doc.body.innerText || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[920px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <FileDown size={20} />
            </div>
            <div>
              <h2 id="pdf-modal-title" className="text-lg font-bold text-white">
                Xuất văn bản phiên tòa (PDF)
              </h2>
              <p className="text-xs text-slate-400 line-clamp-1">
                {caseTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Chọn loại tài liệu & Hành động */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-800/60 border-b border-slate-700/60 shrink-0">
          {/* Tabs chọn loại tài liệu */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => setDocType('result')}
              disabled={!result}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                docType === 'result'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400'
              }`}
            >
              <Award size={14} />
              <span>Kết quả đánh giá</span>
            </button>
            <button
              type="button"
              onClick={() => setDocType('transcript')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                docType === 'transcript'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ScrollText size={14} />
              <span>Biên bản tranh tụng</span>
            </button>
            <button
              type="button"
              onClick={() => setDocType('all')}
              disabled={!result}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                docType === 'all'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400'
              }`}
            >
              <Layers size={14} />
              <span>Hồ sơ đầy đủ</span>
            </button>
          </div>

          {/* Các nút tải / in */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              title="Sao chép toàn bộ nội dung văn bản"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép chữ'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              title="Tải tệp HTML độc lập để lưu trữ và mở xem bất kỳ lúc nào"
            >
              <FileText size={14} />
              <span>Tải file HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              <span>In / Lưu PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Khung xem trước A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm">Đang nạp dữ liệu phiên tòa để xuất PDF...</p>
            </div>
          ) : (
            <div className="w-full max-w-[820px] bg-white rounded-md shadow-2xl p-8 sm:p-12 text-slate-900 border border-slate-300">
              <iframe
                title="Xem trước văn bản PDF"
                srcDoc={documentHtml}
                className="w-full border-0 min-h-[750px] h-[75vh]"
              />
            </div>
          )}
        </div>

        {/* Footer ghi chú */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <p>
            💡 Mẹo: Trong cửa sổ in của trình duyệt, chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> để tải file PDF chuẩn A4.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
