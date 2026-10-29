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

  // Đồng bộ nội dung vào vùng in độc lập #courtsim-print-root để cô lập triệt để khi in
  useEffect(() => {
    if (!open || !documentHtml) return;

    let printRoot = document.getElementById('courtsim-print-root');
    if (!printRoot) {
      printRoot = document.createElement('div');
      printRoot.id = 'courtsim-print-root';
      document.body.appendChild(printRoot);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(documentHtml, 'text/html');
    const styles = doc.querySelectorAll('style');
    let stylesHtml = '';
    styles.forEach((s) => {
      stylesHtml += s.outerHTML;
    });

    const bodyContent = doc.body ? doc.body.innerHTML : documentHtml;
    printRoot.innerHTML = `${stylesHtml}<div class="courtsim-print-page-wrapper">${bodyContent}</div>`;

    return () => {
      if (printRoot) {
        printRoot.innerHTML = '';
      }
    };
  }, [open, documentHtml]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[920px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden text-slate-900">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <FileDown size={20} />
            </div>
            <div>
              <h2 id="pdf-modal-title" className="text-lg font-bold text-slate-900">
                Xuất văn bản phiên tòa (PDF)
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">
                {caseTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Chọn loại tài liệu & Hành động */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
          {/* Tabs chọn loại tài liệu */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDocType('result')}
              disabled={!result}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                docType === 'result'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:hover:text-slate-600'
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
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:hover:text-slate-600'
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs transition-colors"
              title="Sao chép toàn bộ nội dung văn bản"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép chữ'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs transition-colors"
              title="Tải tệp HTML độc lập để lưu trữ và mở xem bất kỳ lúc nào"
            >
              <FileText size={14} />
              <span>Tải file HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-60"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              <span>In / Lưu PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Khung xem trước A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/90 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-medium">Đang nạp dữ liệu phiên tòa để xuất PDF...</p>
            </div>
          ) : (
            <div className="w-full max-w-[840px] bg-white rounded-xl shadow-lg border border-slate-200/90 overflow-hidden flex flex-col">
              <iframe
                title="Xem trước văn bản PDF"
                srcDoc={documentHtml}
                className="w-full border-0 min-h-[750px] h-[75vh] bg-white block"
              />
            </div>
          )}
        </div>

        {/* Footer ghi chú */}
        <div className="px-6 py-2.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <p>
            💡 Mẹo: Trong cửa sổ in của trình duyệt, chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> để tải file PDF chuẩn A4.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
