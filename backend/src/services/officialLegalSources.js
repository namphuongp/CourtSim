import { createHash } from 'node:crypto';
import LegalSourceCheck from '../models/LegalSourceCheck.js';
import { legalAuthorities } from '../data/legalAuthorities.js';

const ALLOWED_HOSTS = new Set(['vbpl.vn', 'congbao.chinhphu.vn', 'chinhphu.vn', 'datafiles.chinhphu.vn']);
const inFlight = new Map();
const TTL = 6 * 60 * 60 * 1000;
export function isOfficialUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && ALLOWED_HOSTS.has(url.hostname); } catch { return false; }
}

export async function fetchOfficialPage(url, fetcher = fetch) {
  if (!isOfficialUrl(url)) throw new Error('Nguồn không được phép.');
  // Không theo redirect để chặn chuyển sang host ngoài danh sách cho phép.
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(4000), headers: { Accept: 'text/html' } });
  if (!response.ok || !/text\/html|text\/plain/i.test(response.headers.get('content-type') ?? '')) throw new Error('Nguồn không truy cập được.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 2_000_000) throw new Error('Nguồn vượt giới hạn dung lượng.');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  return { url, content: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex'), http_status: response.status };
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
