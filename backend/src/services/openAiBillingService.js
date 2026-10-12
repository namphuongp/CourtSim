import { randomUUID } from 'node:crypto';
import { OpenAiDaily, OpenAiSync } from '../models/OpenAiBilling.js';
import AiUsage from '../models/AiUsage.js';
import { billingConfig, billingMonth, billingError, BILLING_ERRORS, safeBillingCode, sumUsd } from './openAiBillingPolicy.js';
import { fetchOpenAiDays } from './openAiOrganizationClient.js';

export async function beginOpenAiSync({ month, trigger = 'manual', initiatedBy } = {}, { now = new Date(), config = billingConfig() } = {}) {
  if (!config.ready) throw billingError('OPENAI_NOT_CONFIGURED', 503);
  const range = billingMonth(month, now);
  if (!range.days.length) throw billingError('OPENAI_INCOMPLETE', 409);
  const jobId = randomUUID(), clock = new Date();
  let job;
  try {
    // _id duy nhất + lease MongoDB ngăn cron và nhiều instance đồng bộ cùng project.
    job = await OpenAiSync.findOneAndUpdate({ _id: config.projectId, $or: [{ leaseUntil: { $lte: clock } }, { leaseUntil: { $exists: false } }] }, {
      $inc: { generation: 1 }, $set: { jobId, month: range.month, trigger, initiatedBy: initiatedBy ?? null,
        status: 'running', startedAt: clock, finishedAt: null, leaseUntil: new Date(clock.getTime() + 300000),
        costsError: null, usageError: null, costsDays: 0, usageDays: 0, expectedDays: range.days.length },
    }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
  } catch (error) {
    if (error.code === 11000) throw billingError('OPENAI_SYNC_BUSY', 409);
    throw billingError('OPENAI_STORAGE_ERROR', 503);
  }
  return { job, config, range };
}

export async function runOpenAiSync(task, dependencies = {}) {
  const { job, config, range } = task;
  const signal = AbortSignal.timeout(120000);
  const owner = { _id: config.projectId, jobId: job.jobId };
  const result = { costsDays: 0, usageDays: 0, costsError: null, usageError: null };
  try {
    // Generation chặn worker cũ ghi đè snapshot của tác vụ mới, kể cả khi lease đã hết.
    await OpenAiDaily.bulkWrite(range.days.map(day => ({ updateOne: { filter: { _id: `${config.projectId}:${day}` },
      update: { $setOnInsert: { projectId: config.projectId, day }, $max: { generation: job.generation } }, upsert: true } })));
    const sources = ['costs', 'usage'];
    const fetched = await Promise.allSettled(sources.map(source => fetchOpenAiDays(source, config, range, { ...dependencies, signal })));
    for (const [index, source] of sources.entries()) {
      const response = fetched[index];
      if (response.status === 'rejected') { result[`${source}Error`] = safeBillingCode(response.reason); continue; }
      const rows = response.value;
      if (signal.aborted || !await OpenAiSync.exists({ ...owner, leaseUntil: { $gt: new Date() } })) throw billingError('OPENAI_SYNC_INTERRUPTED');
      const syncedAt = new Date();
      try {
        if (rows.size) await OpenAiDaily.bulkWrite([...rows].map(([day, snapshot]) => ({ updateOne: {
          filter: { _id: `${config.projectId}:${day}`, generation: job.generation },
          update: { $set: { [source]: { ...snapshot, syncedAt } } }, upsert: true,
        } })));
        result[`${source}Days`] = rows.size;
        if (rows.size !== range.days.length) result[`${source}Error`] = 'OPENAI_INCOMPLETE';
      } catch { result[`${source}Error`] = 'OPENAI_STORAGE_ERROR'; }
    }
  } catch (error) {
    const code = safeBillingCode(error);
    result.costsError ||= code; result.usageError ||= code;
  }
  const status = !result.costsError && !result.usageError ? 'success' : result.costsDays || result.usageDays ? 'partial' : 'failed';
  const finishedAt = new Date();
  try {
    await OpenAiSync.updateOne(owner, { $set: { ...result, status, finishedAt, leaseUntil: finishedAt,
      ...(status === 'success' ? { lastCompletedAt: finishedAt } : {}) } });
  } catch { throw billingError('OPENAI_STORAGE_ERROR', 503); }
  return { status, ...result };
}

export async function syncOpenAiMonth(options, dependencies = {}) {
  return runOpenAiSync(await beginOpenAiSync(options, dependencies), dependencies);
}

const knownSum = values => values.every(value => value != null) ? values.reduce((total, value) => total + value, 0) : null;
const reported = error => error ? { code: error, message: BILLING_ERRORS[error] ?? BILLING_ERRORS.OPENAI_STORAGE_ERROR } : null;

export async function openAiBillingReport(month, { now = new Date(), config = billingConfig() } = {}) {
  const range = billingMonth(month, now);
  const [snapshots, job, estimates] = await Promise.all([
    config.projectId ? OpenAiDaily.find({ projectId: config.projectId, day: { $gte: `${range.month}-01`, $lte: range.days.at(-1) ?? `${range.month}-01` } }).lean() : [],
    config.projectId ? OpenAiSync.findById(config.projectId).lean() : null,
    AiUsage.aggregate([{ $match: { created_at: { $gte: range.from, $lt: range.to } } }, { $group: {
      _id: { $dateToString: { date: '$created_at', format: '%Y-%m-%d', timezone: 'UTC' } }, requests: { $sum: 1 },
      priced: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$estimated_cost', null] }, null] }, 1, 0] } }, cost: { $sum: '$estimated_cost' } } }]),
  ]);
  const saved = new Map(snapshots.map(row => [row.day, row])), estimated = new Map(estimates.map(row => [row._id, row]));
  const byModel = new Map();
  const daily = range.days.map(day => {
    const row = saved.get(day), estimate = estimated.get(day);
    const costsKnown = Boolean(row?.costs?.syncedAt && row.costs.amount != null), usageKnown = Boolean(row?.usage?.syncedAt);
    const models = usageKnown ? row.usage.models : [];
    for (const model of models) {
      const total = byModel.get(model.model) ?? { model: model.model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, requests: 0 };
      for (const field of ['inputTokens', 'outputTokens', 'cachedInputTokens', 'requests']) total[field] = knownSum([total[field], model[field]]);
      byModel.set(model.model, total);
    }
    return { day, actualCost: costsKnown ? row.costs.amount.toString() : null,
      inputTokens: usageKnown ? knownSum(models.map(model => model.inputTokens)) : null,
      outputTokens: usageKnown ? knownSum(models.map(model => model.outputTokens)) : null,
      cachedInputTokens: usageKnown ? knownSum(models.map(model => model.cachedInputTokens)) : null,
      requests: usageKnown ? knownSum(models.map(model => model.requests)) : null,
      costsSyncedAt: row?.costs?.syncedAt ?? null, usageSyncedAt: row?.usage?.syncedAt ?? null,
      costsThrough: row?.costs?.through ?? null, usageThrough: row?.usage?.through ?? null,
      estimatedCost: estimate?.priced ? estimate.cost : null, estimatedRequests: estimate?.requests ?? 0, pricedRequests: estimate?.priced ?? 0,
    };
  });
  const costsDays = daily.filter(row => row.actualCost != null), usageDays = daily.filter(row => row.requests != null);
  const stale = !range.days.length || daily.some(row => !row.costsSyncedAt || !row.usageSyncedAt
    || now - row.costsSyncedAt > 8 * 3600000 || now - row.usageSyncedAt > 8 * 3600000);
  const syncStatus = job?.status === 'running' && job.leaseUntil <= now ? 'interrupted' : job?.status ?? 'never';
  return {
    month: range.month, timezone: 'UTC', currency: 'USD', currentMonth: range.currentMonth,
    configuration: { ready: config.ready, keyConfigured: config.keyConfigured, projectConfigured: config.projectConfigured },
    projectId: config.projectId, usageScope: 'completions',
    actual: { cost: costsDays.length ? sumUsd(costsDays.map(row => row.actualCost)) : null,
      inputTokens: usageDays.length ? knownSum(usageDays.map(row => row.inputTokens)) : null,
      outputTokens: usageDays.length ? knownSum(usageDays.map(row => row.outputTokens)) : null,
      cachedInputTokens: usageDays.length ? knownSum(usageDays.map(row => row.cachedInputTokens)) : null,
      requests: usageDays.length ? knownSum(usageDays.map(row => row.requests)) : null,
      costsDays: costsDays.length, usageDays: usageDays.length, expectedDays: range.days.length,
      hasAllCostDays: range.days.length > 0 && costsDays.length === range.days.length,
      hasAllUsageDays: range.days.length > 0 && usageDays.length === range.days.length,
      lastCostsSyncAt: costsDays.length ? new Date(Math.max(...costsDays.map(row => +row.costsSyncedAt))) : null,
      lastUsageSyncAt: usageDays.length ? new Date(Math.max(...usageDays.map(row => +row.usageSyncedAt))) : null },
    estimated: { cost: daily.some(row => row.pricedRequests) ? sumUsd(daily.filter(row => row.estimatedCost != null).map(row => row.estimatedCost)) : null,
      requests: daily.reduce((sum, row) => sum + row.estimatedRequests, 0), priced: daily.reduce((sum, row) => sum + row.pricedRequests, 0) },
    sync: { status: syncStatus, month: job?.month ?? null, startedAt: job?.startedAt ?? null, finishedAt: job?.finishedAt ?? null,
      lastCompletedAt: job?.lastCompletedAt ?? null, costsError: reported(job?.costsError), usageError: reported(job?.usageError),
      stale },
    daily, models: [...byModel.values()].sort((a, b) => b.requests - a.requests),
  };
}
