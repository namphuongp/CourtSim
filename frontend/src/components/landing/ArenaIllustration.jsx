import { Gavel, Scale, Send, Sparkles } from 'lucide-react';

// Illustration only; live messages, turns and scores are rendered by CourtroomStage.
export default function ArenaIllustration() {
  return <div className="arena-illustration" aria-label="Minh họa phiên tòa mô phỏng" role="img">
    <div className="arena-halo" /><Scale className="arena-emblem" />
    <div className="arena-person arena-judge"><img src="/courtsim-characters/judge-speaking.png" alt="" /><div className="arena-podium" /></div>
    <div className="arena-person arena-opponent"><img src="/courtsim-characters/opposing-lawyer-speaking.png" alt="" /><div className="arena-podium" /></div>
    <div className="arena-person arena-learner"><img src="/courtsim-characters/learner-lawyer-listening.png" alt="" /><div className="arena-podium" /></div>
    <div className="arena-session-chip"><span><Gavel size={21} /></span><div><strong>PHIÊN TÒA MÔ PHỎNG</strong><small>Tranh chấp dân sự · Phúc thẩm</small></div><b>AI</b></div>
    <span className="arena-feedback-chip"><Sparkles size={16} /> PHẢN BIỆN TỨC THÌ</span>
    <div className="arena-chat"><p><i /> Chủ tọa: Mời luật sư trình bày căn cứ bảo vệ thân chủ.</p><div><span>Trình bày lập luận của bạn…</span><Send size={19} /></div><small>Nội dung minh họa</small></div>
  </div>;
}
