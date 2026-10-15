import { User, SimulationSession } from '../models/index.js';
import AiUsage from '../models/AiUsage.js';
import { dateRange } from './adminQuery.js';
const total = { $sum: 1 };
const duration = { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $ne: [{ $ifNull: ['$completed_at', null] }, null] }, { $gte: ['$completed_at', '$created_at'] }] }, { $subtract: ['$completed_at', '$created_at'] }, null] };
async function counts(model, now) {
  const today = dateRange({ range: 'today' }, now), week = dateRange({ range: '7d' }, now), month = dateRange({ range: '30d' }, now);
  const [value] = await model.aggregate([{ $group: { _id: null, total,
    today: { $sum: { $cond: [{ $and: [{ $gte: ['$created_at', today.from] }, { $lt: ['$created_at', today.to] }] }, 1, 0] } },
    week: { $sum: { $cond: [{ $and: [{ $gte: ['$created_at', week.from] }, { $lt: ['$created_at', week.to] }] }, 1, 0] } },
    month: { $sum: { $cond: [{ $and: [{ $gte: ['$created_at', month.from] }, { $lt: ['$created_at', month.to] }] }, 1, 0] } },
  } }]);
  return value ?? { total: 0, today: 0, week: 0, month: 0 };
}
export async function activity(range) {
  const pipeline = [{ $match: { created_at: range.match } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: range.timezone } }, count: total } }];
  const [users, sessions] = await Promise.all([User.aggregate(pipeline), SimulationSession.aggregate(pipeline)]);
  const byUser = new Map(users.map(x => [x._id, x.count])), bySession = new Map(sessions.map(x => [x._id, x.count]));
  // Chỉ điền ngày trống bằng 0 sau khi truy vấn DB thành công, không dựng số liệu mẫu.
  const rows = [];
  for (let time = range.from.getTime(); time < range.to.getTime(); time += 86400000) {
    const day = new Date(time + 7 * 3600000).toISOString().slice(0, 10);
    rows.push({ day, users: byUser.get(day) ?? 0, sessions: bySession.get(day) ?? 0 });
  }
  return rows;
}
export async function aiAnalytics(range) {
  const sums = { requests: total, failures: { $sum: { $cond: ['$success', 0, 1] } },
    inputTokens: { $sum: '$input_tokens' }, outputTokens: { $sum: '$output_tokens' },
    tokensKnown: { $sum: { $cond: [{ $and: [{ $ne: ['$input_tokens', null] }, { $ne: ['$output_tokens', null] }] }, 1, 0] } },
    knownCost: { $sum: '$estimated_cost' }, priced: { $sum: { $cond: [{ $ne: ['$estimated_cost', null] }, 1, 0] } },
    latencyMs: { $avg: '$latency_ms' } };
  const [result] = await AiUsage.aggregate([{ $match: { created_at: range.match } }, { $facet: {
    totals: [{ $group: { _id: null, ...sums } }],
    roles: [{ $group: { _id: '$role', ...sums } }, { $sort: { requests: -1 } }],
    models: [{ $group: { _id: { model: '$model', provider: '$provider' }, ...sums } }, { $sort: { requests: -1 } }],

  } }]);
  const [sessionCosts] = await AiUsage.aggregate([{ $match: { created_at: range.match, session_id: { $ne: null } } },
    { $group: { _id: '$session_id', requests: total, cost: { $sum: '$estimated_cost' }, priced: { $sum: { $cond: [{ $ne: ['$estimated_cost', null] }, 1, 0] } } } },
    { $match: { $expr: { $eq: ['$requests', '$priced'] } } }, { $sort: { cost: -1 } },
    { $facet: { top: [{ $limit: 10 }], stats: [{ $group: { _id: null, average: { $avg: '$cost' }, count: total } }] } },
  ]);
  const summary = result.totals[0] ?? { requests: 0, failures: 0, inputTokens: 0, outputTokens: 0, tokensKnown: 0, knownCost: 0, priced: 0, latencyMs: null };
  const [first] = await AiUsage.find().sort({ created_at: 1 }).limit(1).select('created_at').lean();
  return { ...summary, estimatedCost: summary.priced ? summary.knownCost : null,
    completeCost: summary.requests > 0 && summary.priced === summary.requests,
    errorRate: summary.requests ? summary.failures / summary.requests : null,
    roles: result.roles, models: result.models, expensiveSessions: sessionCosts?.top ?? [],
    costPerSession: sessionCosts?.stats[0]?.average ?? null, pricedSessions: sessionCosts?.stats[0]?.count ?? 0,
    trackingEnabled: process.env.AI_USAGE_TRACKING !== 'false', trackedSince: first?.created_at ?? null, currency: 'USD' };
}
export async function dashboard(query) {
  const now = new Date(), range = dateRange(query, now);
  const [users, sessions, selectedUsers, selectedSessions, unresolved, feedbackTotal, feedbackByStatus, chart, ai, aiToday, aiMonth, recentUsers, recentStarted, recentCompleted, recentFeedback, ongoing] = await Promise.all([
    counts(User, now), counts(SimulationSession, now), User.countDocuments({ created_at: range.match }),
    SimulationSession.aggregate([{ $match: { created_at: range.match } }, { $group: { _id: null, total, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, averageDurationMs: { $avg: duration } } }]),
    SimulationSession.countDocuments({ 'feedback.status': { $in: ['new', 'viewed'] } }), SimulationSession.countDocuments({ 'feedback.created_at': { $exists: true } }),
    SimulationSession.aggregate([{ $match: { 'feedback.created_at': { $exists: true } } }, { $group: { _id: '$feedback.status', count: total } }]),
    activity(range), aiAnalytics(range), aiAnalytics(dateRange({ range: 'today' }, now)), aiAnalytics(dateRange({ range: 'month' }, now)),
    User.find({ created_at: range.match }).select('_id created_at').sort({ created_at: -1 }).limit(6).lean(),
    SimulationSession.find({ created_at: range.match }).select('_id created_at').sort({ created_at: -1 }).limit(6).lean(),
    SimulationSession.find({ completed_at: range.match, status: 'completed' }).select('_id completed_at').sort({ completed_at: -1 }).limit(6).lean(),
    SimulationSession.find({ 'feedback.created_at': range.match }).select('_id feedback.created_at').sort({ 'feedback.created_at': -1 }).limit(6).lean(),
    SimulationSession.countDocuments({ status: 'ongoing' }),
  ]);
  const selected = selectedSessions[0] ?? { total: 0, completed: 0, averageDurationMs: null };
  const events = [
    ...recentUsers.map(x => ({ type: 'user', id: x._id, at: x.created_at, label: 'Người dùng mới đăng ký' })),
    ...recentStarted.map(x => ({ type: 'session', id: x._id, at: x.created_at, label: 'Phiên mô phỏng được bắt đầu' })),
    ...recentCompleted.map(x => ({ type: 'session', id: x._id, at: x.completed_at, label: 'Phiên mô phỏng đã hoàn thành' })),
    ...recentFeedback.map(x => ({ type: 'feedback', id: x._id, at: x.feedback.created_at, label: 'Góp ý mới được gửi' })),
  ].sort((a, b) => b.at - a.at).slice(0, 12);
  return { range, users, sessions, ongoing, feedback: { total: feedbackTotal, unresolved, statuses: feedbackByStatus },
    selected: { users: selectedUsers, sessions: selected.total, completionRate: selected.total ? selected.completed / selected.total : null, averageDurationMs: selected.averageDurationMs },
    sessionsPerUser: users.total ? sessions.total / users.total : null, chart, events, ai, aiToday, aiMonth };
}
