import { useMemo, useState } from 'react';
import { formatDate, formatScore } from '../dashboard/dashboardData.mjs';
import { skills, skillFamilies, skillSeries } from './skillData.mjs';
import { CommentSource } from './SkillComments';

export default function SkillProgress({ evaluated }) {
  const [family, setFamily] = useState('reasoning');
  const [selected, setSelected] = useState('legal_reasoning');
  const options = skillFamilies.find(f => f.id === family).keys;
  const series = useMemo(() => skillSeries(evaluated, selected), [evaluated, selected]);
  const label = skills.find(s => s.id === selected).label;
  const first = series[0]?.time, last = series.at(-1)?.time;
  const points = series.map((p, i) => ({ ...p, x: first === last ? 50 + i / Math.max(1, series.length - 1) * 510 : 50 + (p.time - first) / (last - first) * 510, y: 180 - p.score * 1.5 }));
  return <section className="skill-card space-y-4" aria-labelledby="skill-progress-title">
    <div className="skill-section-heading"><h2 id="skill-progress-title">Tiến bộ theo thời gian</h2><div className="skill-selectors">
      <div><label htmlFor="skill-family">Nhóm kỹ năng</label><select id="skill-family" value={family} onChange={e => { const value = e.target.value; setFamily(value); const keys = skillFamilies.find(f => f.id === value).keys; setSelected(keys.find(id => skillSeries(evaluated, id).length >= 2) ?? keys[0]); }}>{skillFamilies.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
      <div><label htmlFor="skill-series">Kỹ năng cụ thể</label><select id="skill-series" value={selected} onChange={e => setSelected(e.target.value)}>{skills.filter(s => options.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
    </div></div>
    {points.length < 2 ? <p className="skill-empty" role="status">Chưa đủ dữ liệu để thể hiện tiến bộ của {label.toLocaleLowerCase('vi')}. Cần ít nhất 2 phiên có điểm kỹ năng này.</p> : <>
      <svg className="skill-chart" viewBox="0 0 610 220" role="img" aria-label={`Tiến bộ ${label} qua ${points.length} phiên`}>
        {[0, 50, 100].map(value => <g key={value}><line x1="50" x2="560" y1={180 - value * 1.5} y2={180 - value * 1.5} stroke="#d9e2ec" /><text x="8" y={184 - value * 1.5}>{value}</text></g>)}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--courtsim-blue, #1d4ed8)" strokeWidth="2.5" />
        {points.map(p => <circle key={p.session._id} cx={p.x} cy={p.y} r="5" fill="var(--courtsim-blue, #1d4ed8)"><title>{formatDate(p.time)}: {formatScore(p.score)}/100</title></circle>)}
        <text x="50" y="211">{formatDate(first)}</text><text x="560" y="211" textAnchor="end">{formatDate(last)}</text>
      </svg>
      <details><summary>Xem điểm từng phiên</summary><ul className="skill-comments-list">{points.map(p => <li key={p.session._id}><span>{p.session.case_id?.title ?? 'Phiên luyện tập'} — {formatScore(p.score)}/100 · </span><CommentSource session={p.session} /></li>)}</ul></details>
    </>}
  </section>;
}
