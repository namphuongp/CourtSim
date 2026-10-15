import { formatScore } from '../dashboard/dashboardData.mjs';

export default function SkillOverview({ skills }) {
  const measured = skills.filter(s => s.score !== null), missing = skills.filter(s => s.score === null);
  return <section className="skill-card space-y-5" aria-labelledby="skill-overview-title">
    <h2 id="skill-overview-title">Tổng quan kỹ năng</h2>
    {measured.map(skill => <div key={skill.id} className="skill-row">
      <div className="skill-row-title"><h3>{skill.label}</h3><strong>{formatScore(skill.score)}/100</strong></div>
      <progress className="skill-progress" aria-label={skill.label} value={skill.score} max="100" />
      <p className="skill-helper">Dựa trên {skill.count} phiên được chấm kỹ năng này.</p>
    </div>)}
    {missing.length > 0 && <div className="skill-missing"><h3>Chưa đủ dữ liệu</h3><p className="skill-helper">Hoàn thành thêm các phiên được đánh giá để CourtSim xác định kỹ năng này.</p><ul className="skill-tags">{missing.map(s => <li key={s.id}>{s.label}</li>)}</ul></div>}
  </section>;
}
