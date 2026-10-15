import { Link } from 'react-router-dom';
import { learningHighlights, scoreSummary } from '../../../shared/scorePresentation.mjs';

const groupNames = { issue_identification: 'Vấn đề và mục tiêu', legal_application: 'Căn cứ pháp luật', evidence_analysis: 'Tình tiết và chứng cứ', legal_reasoning: 'Xây dựng lập luận', rebuttal: 'Phản biện', adaptation: 'Ứng biến' };
const excerpt = text => text.length <= 250 ? text : `${text.slice(0, 250).replace(/\s+\S*$/u, '')}…`;

export default function ScoringSummary({ result, sessionId }) {
  const summary = scoreSummary(result);
  const highlights = learningHighlights(result.criteria);
  return <div className="score-summary">
    <section aria-labelledby="score-heading" className="score-main-card rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
      <h2 id="score-heading" className="text-sm font-semibold text-blue-700">{summary.provisional ? 'Điểm luyện tập · Tham khảo' : summary.partial ? 'Kết quả phần đã đánh giá' : 'Điểm luyện tập'}</h2>
      <p className="mt-2 text-4xl font-black text-slate-900 sm:text-5xl">{Number.isFinite(summary.earned) ? <>{summary.earned}<span className="text-2xl font-semibold">/{summary.assessed}</span></> : 'Chưa có điểm'}</p>
      <p className="mt-2 font-medium">{summary.partial ? `Đã đánh giá ${summary.assessed}/100 điểm tiêu chí` : 'Đã đánh giá đầy đủ các tiêu chí'}</p>
    </section>
    {result.features?.detailedScoring !== false && <div className="score-highlight-grid grid gap-6 md:grid-cols-2">
      <section className="score-card rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="strengths-heading">
        <h2 id="strengths-heading" className="text-lg font-bold">Bạn đã làm tốt</h2>
        {highlights.strengths.length ? <ul className="mt-4 space-y-5">{highlights.strengths.map(item => <li key={item.id}>
          <p className="font-semibold">{item.strength}</p>
          <blockquote className="mt-2 border-l-2 border-blue-300 pl-3 text-sm leading-6 text-slate-600">“{excerpt(item.quote)}”</blockquote>
          <Link className="mt-1 inline-block text-sm text-blue-700 underline" to={`/simulation/${sessionId}#record-${item.record_id}`}>Xem phát biểu làm căn cứ</Link>
        </li>)}</ul> : <p className="mt-3 text-sm">Chưa có điểm mạnh kèm trích dẫn đủ rõ trong phần được chấm.</p>}
      </section>
      <section className="score-card rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="improvements-heading">
        <h2 id="improvements-heading" className="text-lg font-bold">Thử ở phiên tiếp theo</h2>
        {highlights.improvements.length ? <ol className="mt-4 list-decimal space-y-5 pl-5">{highlights.improvements.map(item => <li key={item.id} className="pl-1 leading-7">
          <p>{item.improvement}</p><p className="mt-1 text-sm text-slate-500">{item.label}</p>
        </li>)}</ol> : <p className="mt-3 text-sm">Chưa ghi nhận mục cần cải thiện trong phần đã chấm. Bạn có thể xem các nhận xét chi tiết bên dưới.</p>}
      </section>
    </div>}
    {result.criteria && <section className="score-groups" aria-labelledby="groups-heading">
      <h2 id="groups-heading" className="text-xl font-bold">Các nhóm kỹ năng</h2>
      <p className="mt-1 text-sm text-slate-600">Mở từng nhóm khi muốn xem điểm, nhận xét và căn cứ của từng tiêu chí.</p>
      <div className="mt-4 space-y-3">{result.criteria.map(group => <details key={group.id} className="score-group rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"><span className="ml-2 font-semibold">{groupNames[group.id] ?? group.label}</span><span className="ml-3 text-sm text-slate-600">{group.assessed_max ? `${group.earned}/${group.assessed_max}${group.assessed_max < group.max ? ' ở phần đã chấm' : ' điểm'}` : 'Chưa đánh giá'}</span></summary>
        {group.items.map(item => <article key={item.id} className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm leading-6">
          <h3 className="font-bold">{item.id}. {item.label} · {item.score === null ? 'Chưa chấm' : `${item.score}/${item.max}`}</h3>
          <p>{item.status === 'not_assessed' && (item.id.startsWith('2.') || item.id === '4.2') ? 'Không tính vào điểm của phiên này.' : item.reason}</p>
          {item.quote && <blockquote className="border-l-2 border-blue-300 pl-3">“{item.quote}” <Link className="text-blue-700 underline" to={`/simulation/${sessionId}#record-${item.record_id}`}>Xem phát biểu</Link></blockquote>}
          {item.status === 'assessed' ? <><p><strong>Điểm mạnh:</strong> {item.strength}</p><p><strong>Cách cải thiện:</strong> {item.improvement}</p></> : !(item.id.startsWith('2.') || item.id === '4.2') && <p>{item.improvement}</p>}
        </article>)}
      </details>)}</div>
    </section>}
    <Link to={`/simulation/${sessionId}#transcript`} className="score-transcript-link inline-block rounded-xl border border-blue-200 bg-white px-5 py-3 font-semibold text-blue-700">Xem lại toàn bộ biên bản</Link>
  </div>;
}
