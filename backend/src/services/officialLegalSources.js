import { createHash } from 'node:crypto';
import LegalSourceCheck from '../models/LegalSourceCheck.js';
import { legalAuthorities } from '../data/legalAuthorities.js';
import { isVbplUrl } from '../../../shared/legalSourcePolicy.mjs';

const inFlight = new Map();
const TTL = 6 * 60 * 60 * 1000;
export const isOfficialUrl = isVbplUrl;

export async function fetchOfficialPage(url, fetcher = fetch, { timeoutMs = 6000, maxBytes = 2_000_000 } = {}) {
  if (!isOfficialUrl(url)) throw new Error('Nguồn không được phép.');
  const signal = AbortSignal.timeout(timeoutMs);
  const redirectsFollowed = [];
  let response;
  // Kiểm tra từng đích trước khi kết nối, dùng chung hạn chờ cho cả chuỗi chuyển hướng.
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!isOfficialUrl(url)) throw new Error('Nguồn không được phép.');
    response = await fetcher(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } });
    if (response.url && !isOfficialUrl(response.url)) throw new Error('Nguồn không được phép.');
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location || redirects === 3) throw new Error('Chuyển hướng nguồn không hợp lệ.');
    const next = new URL(location, url).href;
    redirectsFollowed.push({ url, status: response.status, location: next });
    url = next;
  }
  if (!response.ok || !/text\/html|text\/plain/i.test(response.headers.get('content-type') ?? '')) throw new Error('Nguồn không truy cập được.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maxBytes) throw new Error('Nguồn vượt giới hạn dung lượng.');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  return { url, content: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex'), http_status: response.status, redirects: redirectsFollowed };
}

export async function inspectOfficialSources(lawNumber, { fetcher = fetch, enabled = process.env.LEGAL_ONLINE_LOOKUP !== 'false' } = {}) {
  if (!enabled) return { status: 'disabled', message: 'Chưa xác minh được căn cứ pháp luật: tra cứu Internet đang tắt.', snapshots: [] };
  const authority = legalAuthorities[lawNumber];
  const urls = [...new Set([authority?.sourceUrl, authority?.historyUrl].filter(isOfficialUrl))];
  if (!urls.length) return { status: 'unavailable', message: `Chưa xác minh được căn cứ pháp luật ${lawNumber}: chưa có địa chỉ nguồn chính thức đã đăng ký.`, snapshots: [] };
  const results = await Promise.allSettled(urls.map((url) => fetchOfficialPage(url, fetcher)));
  const snapshots = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const complete = snapshots.length === urls.length && snapshots.every((s) => s.content.includes(lawNumber));
  return { status: complete ? 'pending_review' : 'unavailable', snapshots,
    message: complete ? `Chưa xác minh được căn cứ pháp luật ${lawNumber}: đã tải nguồn, cần đối chiếu nguyên văn, lịch sử sửa đổi và chuyển tiếp.`
      : `Chưa xác minh được căn cứ pháp luật ${lawNumber}: nguồn chính thức không truy cập được hoặc chưa đủ thông tin.` };
}

export async function checkOfficialSources(lawNumber) {
  if (inFlight.has(lawNumber)) return inFlight.get(lawNumber);
  const task = (async () => {
    const cached = await LegalSourceCheck.findOne({ law_number: lawNumber }).lean();
    if (cached?.checked_at && Date.now() - new Date(cached.checked_at).getTime() < TTL) return { status: cached.status, message: cached.message, checked_at: cached.checked_at };
    const result = await inspectOfficialSources(lawNumber);
    await LegalSourceCheck.updateOne({ law_number: lawNumber }, { $set: { ...result, checked_at: new Date() } }, { upsert: true });
    return { status: result.status, message: result.message, checked_at: new Date() };
  })();
  inFlight.set(lawNumber, task);
  try { return await task; } finally { inFlight.delete(lawNumber); }
}
