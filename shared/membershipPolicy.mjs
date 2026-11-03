export const FREE_SESSION_LIMIT = 2;

export const MEMBERSHIP_PLANS = Object.freeze({
  freemium: Object.freeze({ id: 'freemium', name: 'Freemium', legalAssistant: false, detailedScoring: false, skillAnalytics: false, unlimitedSessions: false }),
  'pay-per-use': Object.freeze({ id: 'pay-per-use', name: 'Pay-per-use', legalAssistant: true, detailedScoring: true, skillAnalytics: false, unlimitedSessions: false }),
  lite: Object.freeze({ id: 'lite', name: 'Lite', legalAssistant: true, detailedScoring: true, skillAnalytics: false, unlimitedSessions: false }),
  pro: Object.freeze({ id: 'pro', name: 'Pro', legalAssistant: true, detailedScoring: true, skillAnalytics: true, unlimitedSessions: true }),
});

export function normalizeMembership(tier) {
  if (tier === 'plus') return 'lite'; // Tương thích tài khoản cũ, không ghi đè dữ liệu.
  return Object.hasOwn(MEMBERSHIP_PLANS, tier) ? tier : 'freemium';
}

export function memberFeatures(user) {
  if (user?.system_role === 'admin' || user?.role === 'admin') return { ...MEMBERSHIP_PLANS.pro, id: 'admin', name: 'Quản trị viên' };
  return { ...MEMBERSHIP_PLANS[normalizeMembership(user?.subscription_type ?? user?.tier)] };
}

export function sessionFeatures(session, user) {
  const membership = memberFeatures(user);
  const purchased = MEMBERSHIP_PLANS[normalizeMembership(session?.access_plan)];

  // Trong cả 02 case dùng thử miễn phí đầu tiên của tài khoản Free,
  // người dùng BẮT BUỘC được quyền xem chấm điểm chi tiết (detailedScoring: true) giống hệt tài khoản Pro.
  const isExplicitNonTrial = session?.is_free_trial === false || session?.access_source === 'unauthorized';
  const isFreeTrial = !isExplicitNonTrial && (
    session?.is_free_trial === true ||
    session?.access_source === 'free_trial' ||
    (membership.id === 'freemium' && (session?.access_plan === 'freemium' || !session?.access_plan))
  );

  const detailedScoring = Boolean(membership.detailedScoring || purchased.detailedScoring || isFreeTrial);

  return {
    ...membership,
    legalAssistant: membership.legalAssistant || purchased.legalAssistant,
    detailedScoring,
    isFreeTrial: Boolean(isFreeTrial),
  };
}
