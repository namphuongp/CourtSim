import { useMemo } from 'react';
import useDashboardSessions from '../../../components/dashboard/useDashboardSessions';
import { formatScore } from '../../../components/dashboard/dashboardData.mjs';
import { skillProfile, profileComments } from '../../../components/skills/skillData.mjs';
import SkillOverview from '../../../components/skills/SkillOverview';
import SkillComments from '../../../components/skills/SkillComments';
import SkillProgress from '../../../components/skills/SkillProgress';
import SkillDetails from '../../../components/skills/SkillDetails';
import RecentEvaluations from '../../../components/skills/RecentEvaluations';
import '../../../components/dashboard/dashboard.css';
import '../../../components/skills/skills.css';
import UpgradeNotice from '../../../components/membership/UpgradeNotice';
import useMembership from '../../../components/membership/useMembership';

export default function Analytics() {
  const membership = useMembership();
  if (membership.loading) return <p role="status">Đang kiểm tra quyền lợi phân tích kỹ năng…</p>;
  if (membership.error) return <section className="practice-dashboard"><p role="alert">{membership.error}</p><button onClick={membership.refresh}>Thử lại</button></section>;
  if (!membership.data?.skillAnalytics) return <section className="practice-dashboard"><h1 className="text-3xl font-bold">Đánh giá kỹ năng</h1><UpgradeNotice analytics /></section>;
  return <SkillAnalytics />;
}

function SkillAnalytics() {
  const { sessions, loading, error, retry } = useDashboardSessions({ includeSkills: true });
  const profile = useMemo(() => skillProfile(sessions), [sessions]);
  const comments = useMemo(() => profileComments(profile.evaluated), [profile]);
  const metrics = [
    ['Phiên đã được đánh giá', profile.evaluated.length],
    ['Điểm kỹ năng trung bình', profile.average === null ? 'Chưa đủ dữ liệu' : `${formatScore(profile.average)}/100`],
    ['Kỹ năng mạnh nhất', profile.strongest ? `${profile.strongest.label} · ${formatScore(profile.strongest.score)}/100` : 'Chưa đủ dữ liệu'],
    ['Kỹ năng cần cải thiện', profile.weakest ? `${profile.weakest.label} · ${formatScore(profile.weakest.score)}/100` : profile.strongest ? 'Chưa có kỹ năng thấp hơn để ưu tiên' : 'Chưa đủ dữ liệu'],
  ];
  return <section className="practice-dashboard skill-profile space-y-6">
    <header><h1 className="text-3xl font-bold">Đánh giá kỹ năng</h1><p className="mt-2 text-slate-400">Hồ sơ năng lực từ các phiên luyện tập của bạn: nhận ra điểm mạnh và chọn điều cần luyện tiếp.</p></header>
    {loading ? <p role="status">Đang tải hồ sơ kỹ năng...</p> : error ? <div className="skill-card" role="alert">{error} <button className="skill-link" onClick={retry}>Thử lại</button></div> : <>
      <div className="skill-metrics">{metrics.map(([label, value]) => <article className="skill-card" key={label}><p className="skill-helper">{label}</p><p className="skill-metric-value">{value}</p></article>)}</div>
      <div className="skill-columns"><SkillOverview skills={profile.overview} /><SkillComments comments={comments} /></div>
      <SkillProgress evaluated={profile.evaluated} />
      <SkillDetails skills={profile.overview} evaluated={profile.evaluated} />
      <RecentEvaluations evaluated={profile.evaluated} />
    </>}
  </section>;
}
