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
    bullets: ['Mở 2 tình huống đầu tiên', 'Trải nghiệm mô phỏng phiên tòa', 'Làm quen vai trò, AI phản hồi và chấm điểm'],
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
    bullets: ['Mở 01 case', 'Toàn bộ tính năng mô phỏng phiên tòa', 'Chọn vai trò', 'AI tương tác trong phiên', 'Trợ lý AI', 'Speech-to-Text', 'Chấm điểm /10', 'Feedback chi tiết', 'Lưu kết quả phiên'],
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
    bullets: ['Toàn bộ tính năng mô phỏng', 'Chấm điểm tổng quan', 'Lưu lịch sử kết quả', 'Tiết kiệm hơn so với mua từng case'],
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
    bullets: ['Toàn bộ case trong gói Pro', 'Toàn bộ tính năng mô phỏng', 'Trợ lý AI', 'Speech to text', 'Chấm điểm & feedback chi tiết', 'Lưu lịch sử phiên', 'Các tính năng nâng cao của CourtSim'],
  },
];

export function findPricingPlan(planId) {
  return pricingPlans.find((plan) => plan.id === planId) ?? null;
}

export function checkoutPath(planId) {
  return `/checkout/${encodeURIComponent(planId)}`;
}
