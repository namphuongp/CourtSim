import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData, number, money, date, roleLabel } from './adminData';
import { LoadState, Metric, RangeSelect } from './AdminElements';
import OpenAiBillingPanel from './OpenAiBillingPanel';

export default function AdminAi() {
  const [range, setRange] = useState('month');
  const resource = useAdminData(`/v1/admin/ai/usage?range=${range}`);
  return <>
    <header className="admin-page-heading"><div><h1>AI & Chi phí</h1><p>Đối chiếu chi phí OpenAI và số liệu CourtSim đã ghi nhận.</p></div></header>
    <OpenAiBillingPanel />
    <header className="admin-page-heading"><div><h2>Tracking CourtSim hiện có</h2><p>Ước tính USD theo giá cấu hình; phần này dùng ngày theo giờ Việt Nam.</p></div><RangeSelect value={range} onChange={setRange} /></header>
    <LoadState resource={resource}>{({ data: d }) => <>
      {!d.trackingEnabled && <p className="admin-notice">Chưa bật theo dõi chi phí AI. Số liệu đã lưu vẫn được giữ lại.</p>}
      {!d.requests && <p className="admin-empty">Chưa có dữ liệu AI trong khoảng thời gian này.</p>}
      <div className="admin-metrics">
        <Metric label="Chi phí đã tính (ước tính)" value={money(d.estimatedCost)} note={`${d.priced}/${d.requests} lượt gọi có đủ dữ liệu giá`} />
        <Metric label="Lượt gọi" value={number(d.requests)} note="Gồm cả lần thử lại và lỗi" />
        <Metric label="Token đã ghi nhận" value={number(d.inputTokens + d.outputTokens)} note={`${d.tokensKnown}/${d.requests} lượt có token đầu vào và đầu ra`} />
        <Metric label="Độ trễ trung bình" value={d.latencyMs == null ? 'Chưa có dữ liệu' : `${number(d.latencyMs)} ms`} note={`Tỷ lệ lỗi: ${d.errorRate == null ? 'Chưa có dữ liệu' : number(d.errorRate * 100) + '%'}`} />
      </div>
      {!d.completeCost && <p className="admin-notice">Chi phí chưa đầy đủ: chưa tính lượt gọi thiếu token hoặc chưa cấu hình giá. Không bao gồm dữ liệu trước khi bật theo dõi.</p>}
      <p className="admin-note">Bản ghi đầu tiên: {date(d.trackedSince)}. Lỗi ở đây là lỗi gọi dịch vụ hoặc định dạng phản hồi, không phải điểm chất lượng lập luận.</p>
      <section className="admin-card"><h2>Theo vai trò</h2>{d.roles.length ? <div className="admin-table-scroll"><table><thead><tr><th>Vai trò</th><th>Lượt gọi</th><th>Tỷ lệ lượt gọi</th><th>Chi phí ước tính</th></tr></thead><tbody>{d.roles.map(row => <tr key={row._id}><td>{roleLabel(row._id)}</td><td>{row.requests}</td><td>{number(row.requests / d.requests * 100)}%</td><td>{money(row.priced ? row.knownCost : null)}<small>{row.priced}/{row.requests} lượt có giá</small></td></tr>)}</tbody></table></div> : <p>Chưa có dữ liệu theo vai trò.</p>}<p className="admin-note">Giọng nói chưa có API chuyển âm thanh thành văn bản nên chưa có usage để tính phí.</p></section>
      <section className="admin-card"><h2>Theo model (tracking CourtSim)</h2>{d.models.length ? <div className="admin-table-scroll"><table><thead><tr><th>Model</th><th>Nhà cung cấp</th><th>Lượt gọi</th><th>Token vào / ra</th><th>Chi phí ước tính</th></tr></thead><tbody>{d.models.map((row, index) => <tr key={index}><td>{row._id.model}</td><td>{row._id.provider}</td><td>{row.requests}</td><td>{number(row.inputTokens)} / {number(row.outputTokens)}</td><td>{money(row.priced ? row.knownCost : null)}</td></tr>)}</tbody></table></div> : <p>Chưa có dữ liệu model.</p>}</section>
      <section className="admin-card"><h2>Chi phí theo phiên</h2><p>Trung bình: <strong>{money(d.costPerSession)}</strong> / phiên có đủ giá cho các lượt đã ghi nhận trong khoảng đã chọn ({d.pricedSessions} phiên).</p><p className="admin-note">Đây là chi phí trong khoảng đã chọn, không nhất thiết là toàn bộ chi phí vòng đời phiên. Phiên thiếu giá bị loại khỏi trung bình.</p><h3>Phiên có chi phí cao nhất</h3>{d.expensiveSessions.length ? <div className="admin-table-scroll"><table><thead><tr><th>Phiên</th><th>Lượt gọi</th><th>Chi phí ước tính</th></tr></thead><tbody>{d.expensiveSessions.map(row => <tr key={row._id}><td><Link to={`/admin/sessions/${row._id}`}>{row._id}</Link></td><td>{row.requests}</td><td>{money(row.cost)}</td></tr>)}</tbody></table></div> : <p>Chưa có phiên đủ dữ liệu để tính chi phí.</p>}</section>
    </>}</LoadState>
  </>;
}
