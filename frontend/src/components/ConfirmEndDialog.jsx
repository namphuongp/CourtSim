import { useEffect, useRef, useState } from 'react';
import { 
  Scale, 
  Gavel, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Send, 
  BookOpen, 
  RefreshCw 
} from 'lucide-react';

const EVALUATION_STEPS = [
  { title: 'Tổng hợp biên bản tranh tụng', desc: 'Trích xuất toàn bộ lập luận và các dữ kiện đã đối đáp' },
  { title: 'Đối chiếu căn cứ pháp lý', desc: 'Kiểm tra quy định pháp luật và nguồn trích dẫn vụ án' },
  { title: 'Chấm điểm 6 nhóm tiêu chí Rubric', desc: 'Đánh giá kiến thức, kỹ năng suy luận, dùng chứng cứ và phong thái' },
  { title: 'Tổng hợp nhận xét & xếp loại', desc: 'Hoàn thiện nhận xét chi tiết và hướng dẫn cải thiện năng lực' },
];

const COURT_TIPS = [
  'Lập luận có sức thuyết phục nhất khi gắn kết chặt chẽ sự kiện khách quan trong hồ sơ với điều luật cụ thể.',
  'Đối đáp thẳng vào trọng tâm câu hỏi của Hội đồng xét xử thể hiện phong thái tự tin và sự chuẩn bị kỹ lưỡng.',
  'Trích dẫn đúng bút lục tài liệu là điểm tựa vững chắc để bảo vệ quan điểm trước bên đối lập.',
  'Văn hóa ứng xử chuẩn mực và tuân thủ nghi thức tố tụng luôn tạo ấn tượng chuyên nghiệp trước Hội đồng xét xử.'
];

export default function ConfirmEndDialog({ 
  open, 
  pending, 
  hasDraft, 
  draftContent = '',
  userTurns = 0,
  maxTurns = 20,
  userRole = '',
  onCancel, 
  onConfirm,
  onPollStatus 
}) {
  const ref = useRef(null);
  const [slow, setSlow] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(20);
  const [tipIndex, setTipIndex] = useState(0);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!pending) {
      setActiveStep(0);
      setProgress(20);
      setSlow(false);
      return;
    }

    // Step progression simulation
    const t1 = setTimeout(() => { setActiveStep(1); setProgress(45); }, 2500);
    const t2 = setTimeout(() => { setActiveStep(2); setProgress(72); }, 6000);
    const t3 = setTimeout(() => { setActiveStep(3); setProgress(92); }, 10000);
    const tSlow = setTimeout(() => setSlow(true), 18000);

    // Tips rotation
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % COURT_TIPS.length);
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tSlow);
      clearInterval(tipInterval);
    };
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => { 
      if (dialog && dialog.open) dialog.close(); 
      previous?.focus?.(); 
    };
  }, [open]);

  async function handleManualPoll() {
    if (polling || !onPollStatus) return;
    setPolling(true);
    try {
      await onPollStatus();
    } finally {
      setPolling(false);
    }
  }

  return (
    <dialog 
      ref={ref} 
      aria-labelledby="end-title" 
      aria-describedby="end-description" 
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }} 
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      {pending ? (
        <div className="space-y-5">
          {/* Header when pending */}
          <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/25">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 id="end-title" className="text-xl font-bold text-slate-900">
                Hội đồng Giám khảo AI đang chấm điểm
              </h2>
              <p id="end-description" className="text-sm text-slate-500">
                Đang phân tích dữ liệu phiên tòa và đánh giá theo chuẩn đào tạo kỹ năng tranh tụng
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-500">
              <span>Tiến trình đánh giá</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>

          {/* Evaluation Stepper */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            {EVALUATION_STEPS.map((s, idx) => {
              const isDone = activeStep > idx;
              const isCurrent = activeStep === idx;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : isCurrent ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isDone ? 'text-slate-700' : isCurrent ? 'text-blue-700' : 'text-slate-400'}`}>
                      {s.title}
                    </p>
                    <p className="text-xs text-slate-500">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rotating tip */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/80 p-3 text-xs text-amber-900">
            <BookOpen className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-800">Gợi ý kỹ năng: </span>
              <span className="leading-relaxed">{COURT_TIPS[tipIndex]}</span>
            </div>
          </div>

          {/* Slow warning & actions */}
          {slow && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/90 p-3 text-xs text-blue-900 space-y-2">
              <p>
                Quá trình kiểm chứng căn cứ pháp luật đang mất thêm một chút thời gian. Dữ liệu đã lưu an toàn trên máy chủ.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {onPollStatus && (
                  <button 
                    type="button" 
                    onClick={handleManualPoll} 
                    disabled={polling}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${polling ? 'animate-spin' : ''}`} />
                    {polling ? 'Đang kiểm tra...' : 'Kiểm tra kết quả ngay'}
                  </button>
                )}
                <a className="font-semibold text-blue-700 underline hover:text-blue-800" href="/dashboard/sessions">
                  Về danh sách phiên
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header when normal */}
          <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/25">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h2 id="end-title" className="text-xl font-bold text-slate-900">
                Kết thúc phiên & Nhận đánh giá
              </h2>
              <p id="end-description" className="text-sm text-slate-500">
                Hội đồng Giám khảo AI sẽ tổng hợp và chấm điểm theo 6 nhóm tiêu chí Rubric
              </p>
            </div>
          </div>

          {/* Session Overview Badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs text-slate-500">Tư cách tố tụng</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800" title={userRole || 'Luật sư người học'}>
                {userRole || 'Luật sư người học'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs text-slate-500">Lượt tranh luận đã gửi</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-600">
                {userTurns}/{maxTurns} lượt
              </p>
            </div>
          </div>

          {/* Readiness advisory */}
          {userTurns < 3 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="font-semibold text-amber-800">Khuyến nghị chuyên môn: </strong>
                Luật sư mới thực hiện {userTurns} lượt tranh tụng. Để Hội đồng đánh giá đầy đủ các kỹ năng (mở đầu, tranh luận chứng cứ, đối đáp phản biện), nên tham gia từ 3 lượt trở lên.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="font-semibold text-emerald-800">Đã đủ điều kiện đánh giá: </strong>
                Biên bản tranh tụng đã có đủ dữ kiện để Hội đồng Giám khảo AI tiến hành xếp loại và phản hồi chi tiết.
              </div>
            </div>
          )}

          {/* Draft Notice & Options */}
          {hasDraft && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Bạn còn một lời tranh tụng đang soạn dở ({draftContent.length} ký tự):</span>
              </div>
              <p className="line-clamp-2 rounded-lg bg-white/90 p-2.5 text-xs italic text-slate-600 border border-blue-100">
                “{draftContent.trim()}”
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onConfirm({ sendDraft: true })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  Gửi lời này làm phần kết luận rồi chấm điểm
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm({ sendDraft: false })}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Bỏ qua bản nháp này & Kết thúc ngay
                </button>
              </div>
            </div>
          )}

          {/* Actions when no draft */}
          {!hasDraft && (
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                autoFocus
                onClick={onCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Tiếp tục tranh tụng
              </button>
              <button
                type="button"
                onClick={() => onConfirm({ sendDraft: false })}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Gavel className="h-4 w-4" />
                Xác nhận kết thúc & Chấm điểm
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
