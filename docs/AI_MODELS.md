# Vận hành và tinh chỉnh model AI cho CourtSim

## 1. Kiến trúc vai trò

CourtSim không để một model tự đóng toàn bộ phiên tòa. Backend điều phối ba persona độc lập:

- `judge`: điều hành, giữ trung lập và đặt vấn đề cho lượt tiếp theo.
- `prosecutor`: đóng phía đối lập và phản biện người học.
- `evaluator`: chỉ chạy khi kết thúc để chấm theo rubric.

Mỗi persona có `system_prompt`, `model_id` và `temperature` trong collection `aipersonals`. Có thể dùng ba model khác nhau hoặc dùng chung một model với ba system prompt khác nhau.

## 2. Dùng Gemini API

Đặt khóa trong `backend/.env`:

```env
GEMINI_API_KEY=your-secret-key
AI_JUDGE_MODEL=gemini-3.6-flash
AI_OPPONENT_MODEL=gemini-3.6-flash
AI_EVALUATOR_MODEL=gemini-3.6-flash
```

Chạy `npm run seed` sau khi đổi model. Khóa chỉ được sử dụng ở backend và không được gửi xuống trình duyệt.

## 3. Chạy model local với Ollama (tùy chọn)

Ví dụ tải hai model:

```powershell
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
ollama serve
```

CourtSim gọi endpoint OpenAI-compatible tại `http://127.0.0.1:11434/v1/chat/completions`. Thiết lập `.env`:

```env
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_JUDGE_MODEL=qwen2.5:7b
AI_OPPONENT_MODEL=llama3.1:8b
AI_EVALUATOR_MODEL=qwen2.5:7b
```

Chạy lại `npm run seed` sau khi đổi tên model để cập nhật persona.

## 4. Không fine-tune ngay từ đầu

Nên triển khai theo thứ tự:

1. Prompt + hồ sơ vụ án có cấu trúc.
2. RAG từ văn bản pháp luật đã kiểm tra phiên bản và hiệu lực.
3. Thu thập transcript đã ẩn danh, rubric và đánh giá của giảng viên.
4. Chỉ fine-tune khi đã có tập dữ liệu đủ sạch và xác định được lỗi lặp lại mà prompt/RAG không giải quyết được.

Fine-tune không phải cách tốt để cập nhật luật thường xuyên. Kiến thức pháp luật nên đến từ RAG có trích dẫn; fine-tune chủ yếu dùng để chỉnh phong cách tranh tụng, định dạng phản hồi và tuân thủ vai.

## 5. Dữ liệu huấn luyện đề xuất

Mỗi mẫu dạng JSONL nên gồm:

```json
{"messages":[{"role":"system","content":"Vai và quy tắc phiên tòa"},{"role":"user","content":"Hồ sơ, lịch sử và lượt tranh luận"},{"role":"assistant","content":"Phản biện mẫu đã được chuyên gia duyệt"}],"metadata":{"case_type":"dan_su","role":"judge","quality":5}}
```

Yêu cầu bắt buộc:

- Ẩn danh toàn bộ dữ liệu cá nhân và bí mật vụ án.
- Chuyên gia pháp lý duyệt đáp án và căn cứ.
- Chia train/validation/test theo vụ án, không chia ngẫu nhiên từng tin nhắn để tránh rò rỉ dữ liệu.
- Giữ một bộ eval cố định đo độ chính xác căn cứ, không bịa luật, đúng vai và chất lượng phản biện.
- Không tự động đưa hội thoại người dùng vào tập train khi chưa có đồng ý rõ ràng.

## 6. Đánh giá trước khi phát hành

So sánh model theo cùng bộ hồ sơ và rubric: độ chính xác pháp lý, tỷ lệ bịa căn cứ, khả năng bám hồ sơ, chất lượng phản biện, độ ổn định JSON khi chấm điểm, độ trễ và chi phí. Kết quả AI luôn phải hiển thị là nội dung học tập, không phải tư vấn pháp lý.
