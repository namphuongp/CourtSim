// Dùng chung cho luồng model và luồng trình duyệt; giới hạn bộ đệm khi đầu kia không kết thúc frame.
export async function* readSse(body, maxBytes = 500_000) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('SSE_SIZE_LIMIT');
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data) yield data;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
