import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import CourtSimBrand from '../../components/CourtSimBrand';
import UserHeader from '../../components/UserHeader';
import { getCurrentUser } from '../../services/auth';
import { checkoutPath, pricingPlans, pricingFeatures } from '../../services/pricingPlans';
import './pricing.css';

export default function PricingPage() {
  return <div className="user-shell pricing-page">
    {getCurrentUser()?.id ? <UserHeader /> : <header className="user-header"><div className="user-header-inner user-header-top"><CourtSimBrand /><nav className="user-header-actions"><Link to="/guide">Hướng dẫn</Link><Link to="/login">Đăng nhập</Link><Link to="/register">Bắt đầu miễn phí</Link></nav></div></header>}
    <main className="user-content"><header className="pricing-hero"><p>ĐỒNG HÀNH CÙNG BẠN</p><h1>Chọn gói luyện tập</h1><p>Trải nghiệm miễn phí, mua từng lượt hoặc chọn gói phù hợp với nhịp học.</p></header>
      <div className="pricing-grid">{pricingPlans.map(plan => <article key={plan.id} className={`pricing-card ${plan.id === 'pro' ? 'is-featured' : ''}`}><div className="pricing-plan-name"><h2>{plan.name}</h2>{plan.id === 'pro' && <span>Đầy đủ tính năng</span>}</div><strong className="pricing-price">{plan.amount === 0 ? '0đ' : new Intl.NumberFormat('vi-VN').format(plan.amount) + 'đ'}</strong><p className="pricing-cadence">{plan.cadence}</p><p>{plan.description}</p><ul>{plan.bullets.map(text => <li key={text}><Check size={15} />{text}</li>)}</ul><Link className="pricing-action" to={checkoutPath(plan.id)}>{plan.checkoutLabel}<ArrowRight size={16} /></Link></article>)}</div>
      <div className="pricing-comparison" role="region" aria-label="So sánh quyền lợi thành viên" tabIndex={0}><table><caption>Quyền lợi theo gói thành viên</caption><thead><tr><th scope="col">Chức năng</th>{pricingPlans.map(plan => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead><tbody><tr><th scope="row">Số lượt mở phiên</th><td>2 lượt miễn phí</td><td>Thêm 1 lượt</td><td>Thêm 5 lượt</td><td>Không trừ lượt</td></tr>{[['legalAssistant', 'Trợ lý luật'], ['detailedScoring', 'Chấm điểm chi tiết'], ['skillAnalytics', 'Phân tích kỹ năng nâng cao']].map(([feature, label]) => <tr key={feature}><th scope="row">{label}</th>{pricingPlans.map(plan => <td key={plan.id}>{pricingFeatures(plan.id)[feature] ? '✓' : '—'}</td>)}</tr>)}<tr><th scope="row">Lịch sử và biên bản</th>{pricingPlans.map(plan => <td key={plan.id}>✓</td>)}</tr></tbody></table></div>
      <p className="pricing-note">Tất cả gói đều có tối đa 20 lượt trình bày mỗi phiên và chịu hạn mức AI. Chỉ có điểm toàn bài khi đủ dữ liệu đánh giá. Quyền lợi được cập nhật sau khi hệ thống xác nhận thanh toán.</p>
    </main>
  </div>;
}
