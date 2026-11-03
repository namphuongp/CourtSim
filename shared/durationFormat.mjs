/**
 * Format số giây thành chuỗi thời gian gọn gàng:
 * - Dưới 1 giờ: MM:SS (vd: 05:24)
 * - Từ 1 giờ trở lên: HH:MM:SS (vd: 01:12:45)
 */
export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '00:00';
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format số giây thành chuỗi mô tả tiếng Việt chi tiết:
 * vd: 5 phút 24 giây, 1 giờ 10 phút 15 giây
 */
export function formatDurationLong(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '0 giây';
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);

  const parts = [];
  if (hrs > 0) parts.push(`${hrs} giờ`);
  if (mins > 0) parts.push(`${mins} phút`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} giây`);
  return parts.join(' ');
}
