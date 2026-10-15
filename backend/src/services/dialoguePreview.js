// Chỉ đọc chuỗi content sau metadata hoàn chỉnh; không eval JSON/HTML từ model.
export function readDialoguePreview(raw) {
  const match = /"content"\s*:\s*"/u.exec(raw);
  if (!match) return null;
  let metadata;
  try { metadata = JSON.parse(raw.slice(0, match.index) + '"content":""}'); } catch { return null; }
  if (!metadata.focus || !Array.isArray(metadata.citation_ids)) return null;
  const start = match.index + match[0].length;
  let encoded = '', escaped = false;
  for (const ch of raw.slice(start)) {
    if (ch === '"' && !escaped) break;
    encoded += ch;
    if (ch === '\\' && !escaped) escaped = true; else escaped = false;
  }
  let content;
  try { content = JSON.parse('"' + encoded + '"'); } catch { return null; }
  // Không hiện từ/câu dở dang; mỗi lần mở thêm câu đã thực sự nhận được.
  const boundary = [...content.matchAll(/[.!?](?=\s|$)/gu)].at(-1);
  if (!boundary) return null;
  content = content.slice(0, boundary.index + 1);
  return { ...metadata, content };
}
