import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { formatDuration, formatDurationLong } from '../../../../shared/durationFormat.mjs';

/**
 * Component Đồng hồ đếm giờ theo dõi thời lượng diễn ra phiên tòa:
 * - Bắt đầu tính giờ tự động từ khi phiên tòa bắt đầu (session.created_at).
 * - Cập nhật liên tục theo thời gian thực mỗi giây.
 * - Tự động dừng đếm khi phiên tòa kết thúc.
 * - Chỉ đếm thời lượng, tuyệt đối không can thiệp hay ngắt phiên.
 */
export default function SessionTimer({ session, completed = false }) {
  const isCompleted = completed || session?.status === 'completed';

  const [elapsed, setElapsed] = useState(() => {
    if (!session) return 0;
    if (isCompleted) {
      if (session.duration_seconds > 0) return session.duration_seconds;
      if (session.completed_at && session.created_at) {
        return Math.max(0, Math.floor((new Date(session.completed_at).getTime() - new Date(session.created_at).getTime()) / 1000));
      }
    }
    if (session.created_at) {
      return Math.max(0, Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000));
    }
    return 0;
  });

  useEffect(() => {
    if (isCompleted || !session?.created_at) return;

    const startMs = new Date(session.created_at).getTime();
    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };

    tick();
    const timerId = setInterval(tick, 1000);

    return () => clearInterval(timerId);
  }, [isCompleted, session?.created_at]);

  const finalDuration = isCompleted
    ? (session?.duration_seconds > 0
        ? session.duration_seconds
        : (session?.completed_at && session?.created_at
            ? Math.max(0, Math.floor((new Date(session.completed_at).getTime() - new Date(session.created_at).getTime()) / 1000))
            : elapsed))
    : elapsed;

  const formatted = formatDuration(finalDuration);
  const readable = formatDurationLong(finalDuration);

  return (
    <div
      className={`trial-timer-badge ${isCompleted ? 'is-completed' : 'is-running'}`}
      title={`Thời lượng phiên tòa: ${readable} (${isCompleted ? 'Đã kết thúc' : 'Đang tính thời gian thực'})`}
      role="timer"
      aria-label={`Thời lượng phiên tòa: ${readable}`}
    >
      <Clock size={13} className="trial-timer-icon" aria-hidden="true" />
      <span className="trial-timer-label">Thời lượng</span>
      <span className="trial-timer-digits">{formatted}</span>
      {!isCompleted ? (
        <span className="trial-timer-pulse" title="Đang tính thời gian thực" aria-hidden="true" />
      ) : (
        <span className="trial-timer-stopped-dot" title="Đã dừng" aria-hidden="true" />
      )}
    </div>
  );
}
