import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import { money, number } from './adminData';
import { Metric } from './AdminElements';

const utc = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) + ' UTC' : 'Chưa đồng bộ';
const errors = {
  OPENAI_NOT_CONFIGURED: 'Cần cấu hình OPENAI_ADMIN_KEY và OPENAI_PROJECT_ID trên backend.',
  OPENAI_SYNC_BUSY: 'Một tác vụ đồng bộ đang chạy. Vui lòng chờ hoàn tất.',
  INVALID_BILLING_MONTH: 'Chọn tháng hợp lệ, không nằm trong tương lai.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
};
const statusLabel = { never: 'Chưa đồng bộ', running: 'Đang đồng bộ', success: 'Đồng bộ thành công', partial: 'Đồng bộ một phần', failed: 'Đồng bộ thất bại', interrupted: 'Đồng bộ bị gián đoạn' };

export default function OpenAiBillingPanel({ compact = false }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const response = await api.get('/v1/admin/ai/openai', { params: { month }, signal: controller.signal, timeout: 20000 });
        if (controller.signal.aborted) return;
        setReport(response.data.data);
        setError('');
        // Đọc snapshot đã lưu; polling không gọi API OpenAI hoặc tạo job mới.
        if (response.data.data.sync.status === 'running') timer = setTimeout(load, 3000);
      } catch (failure) {
        if (!controller.signal.aborted) setError(errors[failure.response?.data?.error?.code] ?? 'Chưa tải được báo cáo. Hãy làm mới để thử lại.');
      }
    }
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [month, refresh]);
  const data = report?.month === month ? report : null;
  async function sync() {
    setBusy(true); setError('');
    try {
      await api.post('/v1/admin/ai/openai/sync', { month }, { timeout: 20000 });
      setRefresh(value => value + 1);
    } catch (failure) {
      setError(errors[failure.response?.data?.error?.code] ?? 'Chưa bắt đầu được đồng bộ. Hãy kiểm tra quyền admin và thử lại.');
    } finally { setBusy(false); }
  }
  return <section className="admin-card" aria-label="Chi phí OpenAI">
    <h2>Chi phí OpenAI theo tháng · UTC</h2>
    <div className="admin-filters">
      <label>Tháng UTC<input type="month" min="2000-01" max={new Date().toISOString().slice(0, 7)} value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} /></label>
      <button onClick={() => setRefresh(value => value + 1)}>Làm mới báo cáo</button>
      <button onClick={sync} disabled={busy || !data?.configuration.ready || data.sync.status === 'running'}>{busy || data?.sync.status === 'running' ? 'Đang đồng bộ…' : 'Đồng bộ OpenAI'}</button>
    </div>
    {error && <p role="alert" className="admin-notice">{error}</p>}
    {!data ? <p role="status">{error ? 'Báo cáo chưa khả dụng.' : 'Đang tải báo cáo…'}</p> : <>
      {!data.configuration.ready && <p className="admin-note">Chưa thiết lập kết nối OpenAI.</p>}
      <p className="admin-note">Project: {data.projectId ?? 'Chưa cấu hình'} · {statusLabel[data.sync.status]}{data.sync.month && data.sync.month !== month ? ` (tháng ${data.sync.month})` : ''}</p>
      {[['Costs', data.sync.costsError], ['Usage', data.sync.usageError]].filter(([, issue]) => issue && issue.code !== 'OPENAI_INCOMPLETE').map(([source, issue]) => <p role="alert" className="admin-notice" key={source}>{source}: {issue.message}</p>)}
      <div className="admin-metrics">
        <Metric label="Actual OpenAI Cost" value={money(data.actual.cost)} note={`USD từ OpenAI · ${data.actual.costsDays}/${data.actual.expectedDays} ngày có dữ liệu`} />
        <Metric label="Estimated CourtSim Cost" value={money(data.estimated.cost)} note={`${data.estimated.priced}/${data.estimated.requests} lượt tracking có giá · USD ước tính`} />
        <Metric label="Lượt gọi OpenAI" value={number(data.actual.requests)} note={`Completions · ${data.actual.usageDays}/${data.actual.expectedDays} ngày có dữ liệu`} />
        <Metric label="Token vào / ra" value={`${number(data.actual.inputTokens)} / ${number(data.actual.outputTokens)}`} note={`Cache: ${number(data.actual.cachedInputTokens)} token, đã nằm trong token đầu vào`} />
      </div>
      <p>Đồng bộ Costs gần nhất: {utc(data.actual.lastCostsSyncAt)}<br />Đồng bộ Usage gần nhất: {utc(data.actual.lastUsageSyncAt)}</p>
      {compact ? <Link to="/admin/ai">Xem chi tiết theo ngày và model →</Link> : <>
        <h3>Chi phí và usage từng ngày (UTC)</h3>
        <div className="admin-table-scroll"><table><thead><tr>{['Ngày', 'Actual (USD)', 'Estimated (USD)', 'Token vào', 'Token cache', 'Token ra', 'Lượt gọi'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.daily.map(row => <tr key={row.day}><td>{row.day}</td><td>{money(row.actualCost)}</td><td>{money(row.estimatedCost)}</td><td>{number(row.inputTokens)}</td><td>{number(row.cachedInputTokens)}</td><td>{number(row.outputTokens)}</td><td>{number(row.requests)}</td></tr>)}</tbody></table></div>
        <h3>Usage OpenAI theo model</h3>
        {data.models.length ? <div className="admin-table-scroll"><table><thead><tr>{['Model', 'Token vào', 'Token cache', 'Token ra', 'Lượt gọi'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.models.map(row => <tr key={row.model ?? 'unknown'}><td>{row.model ?? 'OpenAI chưa xác định model'}</td><td>{number(row.inputTokens)}</td><td>{number(row.cachedInputTokens)}</td><td>{number(row.outputTokens)}</td><td>{number(row.requests)}</td></tr>)}</tbody></table></div> : <p>Chưa có usage theo model.</p>}
      </>}
    </>}
  </section>;
}
