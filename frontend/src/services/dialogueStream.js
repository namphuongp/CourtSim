import api from './api';
import { readSse } from '../../../shared/readSse.mjs';
import { learnerPayload } from '../../../shared/learnerText.mjs';

export async function postDialogue(sessionId, command, onSpeech) {
  const response = await fetch(`${api.defaults.baseURL}/v1/sessions/${encodeURIComponent(sessionId)}/dialogue`, {
    method: 'POST', credentials: 'include', signal: AbortSignal.timeout(150_000),
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-CourtSim-Request': '1' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw Object.assign(new Error('DIALOGUE_FAILED'), { response: { status: response.status, data: await response.json() } });
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return { data: learnerPayload(await response.json()) };
  let result;
  for await (const frame of readSse(response.body, 2_000_000)) {
    const event = JSON.parse(frame);
    if (event.type === 'speech' && ['judge', 'opponent'].includes(event.role) && typeof event.content === 'string') onSpeech(learnerPayload(event));
    if (event.type === 'error') throw Object.assign(new Error('DIALOGUE_FAILED'), { response: { status: 503, data: { error: event.error } } });
    if (event.type === 'complete') result = { data: learnerPayload(event.result) };
  }
  if (result) return result;
  throw new Error('DIALOGUE_INTERRUPTED');
}
