import { formatScore } from '../dashboard/dashboardData.mjs';
import { CommentSource } from './SkillComments';

export default function SkillDetails({ skills, evaluated }) {
  return <section className="skill-card space-y-4" aria-labelledby="skill-details-title"><h2 id="skill-details-title">Phân tích chi tiết</h2>
    {skills.map(skill => {
      const notes = evaluated.map(session => ({ session, detail: session.result.skill_insights?.details?.find(d => d.id === skill.id) }))
        .filter(({ detail }) => detail && [detail.feedback, detail.strengths, detail.improvements].some(list => list?.length)).slice(0, 2);
      return <details key={skill.id} className="skill-detail"><summary>{skill.label}<span>{skill.score === null ? 'Chưa đủ dữ liệu' : `${formatScore(skill.score)}/100`}</span></summary>
        {notes.length ? notes.map(({ session, detail }) => <div className="skill-detail-note" key={session._id}><CommentSource session={session} />
          {[['Nhận xét', detail.feedback], ['Điểm mạnh', detail.strengths], ['Cần cải thiện', detail.improvements]].map(([label, values]) => values?.length > 0 && <div key={label}><h3>{label}</h3><ul className="skill-comments-list">{values.map((value, i) => <li key={i}>{value}</li>)}</ul></div>)}
        </div>) : <p className="skill-empty">{skill.score === null ? 'Hoàn thành thêm các phiên được đánh giá để CourtSim xác định kỹ năng này.' : 'Đã có điểm nhưng chưa có nhận xét chi tiết được lưu cho kỹ năng này.'}</p>}
      </details>;
    })}
  </section>;
}
