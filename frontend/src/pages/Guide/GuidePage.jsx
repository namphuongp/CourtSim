import { ArrowLeft, BookOpen, Gavel, MessageSquare, Scale, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../services/auth';

const steps = [
  { icon: BookOpen, title: '1. Chọn hồ sơ', text: 'Đọc tóm tắt và toàn bộ hồ sơ. Chỉ sử dụng tình tiết có trong hồ sơ; đừng tự thêm chứng cứ.' },
  { icon: Scale, title: '2. Chọn vai luật sư', text: 'Chọn phía bạn bảo vệ. Bên đối lập sẽ phản biện, Chủ tọa điều hành phiên.' },
  { icon: MessageSquare, title: '3. Tranh luận theo lượt', text: 'Nêu yêu cầu, tình tiết và chứng cứ. Đọc từng lời thoại rồi bấm Tiếp tục; Chủ tọa hoặc bên đối lập phát biểu tùy nội dung và giai đoạn luyện tập.' },
  { icon: Trophy, title: '4. Xem kết quả', text: 'Kết thúc sau ít nhất một lượt. Kết quả gồm 6 nhóm: vấn đề và mục tiêu (15), pháp luật (20), chứng cứ (20), lập luận (20), phản biện (15), ứng biến (10). Phần chưa đủ dữ liệu được ghi rõ, không tính 0 và không quy đổi thành điểm toàn bài.' },
];

export default function GuidePage() {
  const authenticated = Boolean(getCurrentUser()?.id);
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-200"><div className="mx-auto max-w-5xl space-y-10">
      <header><Link to={authenticated ? '/dashboard/setup' : '/'} className="mb-6 inline-flex items-center gap-2 text-sm text-blue-300"><ArrowLeft size={17} /> Quay lại</Link><div className="flex items-center gap-3"><Gavel className="text-blue-400" size={34} /><div><h1 className="text-4xl font-bold text-white">Hướng dẫn phiên tòa mô phỏng</h1><p className="mt-2 text-slate-400">Các bước bắt đầu và hoàn thành một phiên luyện tập.</p></div></div></header>
      <section className="grid gap-5 md:grid-cols-2">{steps.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><Icon className="mb-4 text-blue-400" /><h2 className="text-xl font-bold text-white">{title}</h2><p className="mt-2 leading-7 text-slate-400">{text}</p></article>)}</section>
      <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-7"><h2 className="text-xl font-bold text-amber-300">Cấu trúc một lượt trình bày tốt</h2><ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-300"><li>Nêu rõ vấn đề pháp lý hoặc yêu cầu cần giải quyết.</li><li>Viện dẫn tình tiết và chứng cứ trong hồ sơ.</li><li>Nêu căn cứ pháp luật nếu bạn chắc chắn; không bịa số điều.</li><li>Phản biện luận điểm gần nhất của phía đối lập.</li><li>Kết luận ngắn gọn về đề nghị gửi Hội đồng xét xử.</li></ol></section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-7"><h2 className="text-xl font-bold text-white">Lưu ý khi luyện tập</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-slate-400"><li>AI có thể trả lời sai hoặc viện dẫn chưa chính xác; hãy kiểm tra với văn bản pháp luật chính thức.</li><li>Không tải lên thông tin cá nhân, bí mật nghề nghiệp hoặc hồ sơ vụ án thật chưa được ẩn danh.</li><li>Điểm số chỉ phản ánh buổi thực hành, không đánh giá năng lực hành nghề và không thay thế tư vấn pháp lý.</li></ul></section>
      {authenticated && <div className="text-center"><Link to="/dashboard/setup" className="inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold text-white">Thiết lập phiên mới</Link></div>}
    </div></main>
  );
}
