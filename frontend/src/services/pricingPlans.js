import { MEMBERSHIP_PLANS } from '../../../shared/membershipPolicy.mjs';

export const pricingPlans = [
  {
    id: 'freemium',
    type: 'freemium',
    name: 'Freemium',
    price: '2 case đầu tiên miễn phí',
    amount: 0,
    cadence: 'Dùng thử',
    checkoutLabel: 'Bắt đầu miễn phí',
    description: 'Trải nghiệm trực tiếp giá trị của CourtSim trước khi quyết định trả phí.',
    bullets: ['02 lượt mô phỏng miễn phí cho mỗi tài khoản', 'Chọn vai luật sư, đối đáp với AI', 'Kết quả và nhận xét tổng quan', 'Xem lại biên bản và lịch sử', 'Chưa bao gồm trợ lý luật và điểm chi tiết'],
  },
  {
    id: 'pay-per-use',
    type: 'case',
    name: 'Pay-per-use',
    price: '30.000 VNĐ/case',
    amount: 30000,
    cadence: 'Mua từng case',
    checkoutLabel: 'Mua 1 case',
    description: 'Phù hợp với người dùng luyện tập không thường xuyên và chưa muốn đăng ký gói dài hạn.',
    bullets: ['Mở 01 lượt mô phỏng', 'Chọn vai luật sư', 'Tranh luận bằng văn bản với AI', 'Trợ lý tra cứu luật', 'Đánh giá theo tiêu chí có đủ dữ liệu', 'Feedback chi tiết', 'Lưu kết quả phiên'],
  },
  {
    id: 'lite',
    type: 'lite',
    name: 'Lite',
    price: '99.000 VNĐ',
    amount: 99000,
    cadence: 'Bundle 5 case',
    checkoutLabel: 'Thanh toán gói Lite',
    description: 'Mở 5 case theo bundle Lite, tiết kiệm hơn so với mua từng case riêng lẻ.',
    bullets: ['Cộng 05 lượt mô phỏng', 'Chọn vai luật sư, đối đáp với AI', 'Trợ lý tra cứu luật', 'Chấm điểm chi tiết theo tiêu chí', 'Lưu lịch sử kết quả', 'Tiết kiệm hơn so với mua từng lượt'],
  },
  {
    id: 'pro',
    type: 'pro',
    name: 'Pro',
    price: '249.000 VNĐ',
    amount: 249000,
    cadence: 'Bundle nâng cao',
    checkoutLabel: 'Thanh toán gói Pro',
    description: 'Dành cho người dùng luyện tập thường xuyên và cần bộ tính năng đầy đủ hơn.',
    bullets: ['Không trừ lượt mở phiên', 'Tranh luận bằng văn bản với AI', 'Trợ lý tra cứu luật', 'Chấm điểm & feedback chi tiết', 'Phân tích kỹ năng và theo dõi tiến bộ', 'Lưu lịch sử phiên'],
  },
];

export function findPricingPlan(planId) {
  return pricingPlans.find((plan) => plan.id === planId) ?? null;
}

export function savedCheckoutPlan(order) {
  const id = order.plan?.id ?? (order.type === 'case' ? 'pay-per-use' : order.type);
  const current = findPricingPlan(id);
  if (!current && !order.plan?.name) return null;
  const plan = { ...current, ...order.plan, id, amount: order.amount };
  const features = plan.features ?? MEMBERSHIP_PLANS[id] ?? {};
  const entitlement = plan.entitlement;
  // Benefits and totals describe the purchased snapshot, including older prices/quantities.
  const bullets = [
    ...(entitlement?.type === 'case_credit' ? [`Cộng ${entitlement.quantity} lượt mô phỏng`]
      : features.unlimitedSessions ? ['Không trừ lượt mở phiên'] : []),
    'Chọn vai luật sư, đối đáp với AI',
    ...(features.legalAssistant ? ['Trợ lý tra cứu luật'] : []),
    features.detailedScoring ? 'Chấm điểm và feedback chi tiết theo dữ liệu đủ điều kiện' : 'Kết quả và nhận xét tổng quan',
    ...(features.skillAnalytics ? ['Phân tích kỹ năng và theo dõi tiến bộ'] : []),
    'Lưu lịch sử kết quả',
  ];
  return { ...plan, price: new Intl.NumberFormat('vi-VN').format(order.amount) + ' VNĐ', bullets };
}

export function pricingFeatures(planId) {
  return MEMBERSHIP_PLANS[planId];
}

export function checkoutPath(planId) {
  return `/checkout/${encodeURIComponent(planId)}`;
}
