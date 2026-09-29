// Chỉ dùng cho lời dẫn và phản hồi CourtSim tự tạo, không dùng để sửa tài liệu gốc.
export const RESPONSE_STYLE = 'Viết tiếng Việt tự nhiên, ngắn gọn. Gọi các vai là Chủ tọa, Bên đối lập và bạn; không thêm AI vào tên vai. Đi thẳng vào luận điểm, tránh lời dẫn máy móc hoặc nhắc lại đề bài. Không đọc tên model, mã lỗi, ID, tên trường, trạng thái nội bộ hay quy trình truy xuất. Không lặp cảnh báo chung; chỉ nêu ngắn gọn giới hạn nguồn khi liên quan trực tiếp. Giữ nguyên văn các trích dẫn từ luật, bản án, chứng cứ và phát biểu của người học; không tự sửa nội dung bên trong trích dẫn.';

export const TECHNICAL_TEXT = /localhost|127\.0\.0\.1|stack\s*trace|\b\w+Error\b|Network Error|fetch failed|SQLSTATE|ENOENT|status code \d+|(?:Type|Reference|Syntax|MongoServer|Axios)Error|\b(?:ECONN\w*|ETIMEDOUT|ERR_\w+|E11000)\b|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|Cannot (?:GET|POST|PATCH|PUT|DELETE)|Không tìm thấy (?:GET|POST|PATCH)|<\/?(?:html|body|script)|\/api\/|\b(?:model|prompt|api[_ -]?key)\s*[:=]|\b(?:gpt-\w+|gemini-[\w.-]+|claude-[\w.-]+)|\[CC:|\[PL:|\b(?:EV|LAW)-[\w-]+|mentioned_only|\b(?:request_id|case_id|full_document|user_court_role|citation_ids)\b/iu;

export function publicErrorMessage(message, code, status, fallback = 'Chưa thể thực hiện thao tác. Vui lòng thử lại.') {
  if (code === 'AI_TIMEOUT') return 'Phản hồi quá thời gian chờ. Các lượt đã gửi vẫn được giữ lại; bạn có thể thử lại.';
  // Lỗi nhà cung cấp/kiểm định không được đưa nội dung vận hành ra API công khai.
  if (typeof code === 'string' && /^(?:AI_|ASSISTANT_)/u.test(code) && status >= 500) return fallback;
  if (status >= 500) return fallback;
  if (typeof message !== 'string' || TECHNICAL_TEXT.test(message)) return fallback;
  return message.trim() || fallback;
}
