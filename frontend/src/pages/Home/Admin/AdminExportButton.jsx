import { useRef, useState } from 'react';
import api from '../../../services/api';

export default function AdminExportButton({ kind, query, disabled = false }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams(query);
      params.delete('page'); params.delete('limit');
      const { data } = await api.get(`/v1/admin/${kind}/export?${params}`, { responseType: 'blob', timeout: 120000 });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `courtsim-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      let code;
      try { code = JSON.parse(await err.response?.data?.text()).error?.code; } catch { /* Non-JSON network/proxy error. */ }
      setError(code === 'EXPORT_TOO_LARGE' ? 'Có quá 10.000 dòng. Hãy thu hẹp bộ lọc trước khi xuất Excel.' : 'Chưa thể xuất Excel. Vui lòng thử lại.');
    } finally { lock.current = false; setBusy(false); }
  }
  return <div><button type="button" onClick={download} disabled={disabled || busy} title="Xuất toàn bộ kết quả theo bộ lọc hiện tại (tối đa 10.000 dòng)">{busy ? 'Đang xuất Excel…' : 'Xuất Excel'}</button>{error && <p role="alert" className="feedback-error">{error}</p>}</div>;
}
