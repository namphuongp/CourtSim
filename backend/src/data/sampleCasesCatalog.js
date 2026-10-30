import mongoose from 'mongoose';
import Case from '../models/Case.js';
import { sampleLandCase } from './sampleLandCase.js';
import { case1Appeal } from './case1Appeal.js';

export const caseAnPhucMai = {
  _id: '6ac100000000000000000003',
  title: 'Yêu cầu bảo vệ danh dự, nhân phẩm và bồi thường thiệt hại tại Cơ sở lưu trú An Phúc (Vụ án Nguyễn Ngọc Mai)',
  category: 'Dân sự - Bảo vệ quyền nhân thân & Bồi thường thiệt hại ngoài hợp đồng',
  reference_date: '2026-09-15',
  reference_date_note: 'Mốc ngày 15/09/2026 là thời điểm lập Bản tường trình số 02-BV/2026 tại Cơ quan điều tra ngay sau sự việc ngày 14/09/2026 tại Cơ sở lưu trú An Phúc.',
  legal_scope_note: 'Đối chiếu quy định về quyền được bảo vệ danh dự, nhân phẩm, uy tín (Điều 34 Bộ luật Dân sự 2015), căn cứ phát sinh trách nhiệm bồi thường thiệt hại ngoài hợp đồng (Điều 584, Điều 585, Điều 592 Bộ luật Dân sự 2015) và nghĩa vụ chứng minh, đánh giá chứng cứ (Điều 91, Điều 93, Điều 95, Điều 108 Bộ luật Tố tụng dân sự 2015).',
  summary: 'Ngày 12/09/2026, chị Nguyễn Ngọc Mai liên hệ ứng tuyển công việc nhân viên hỗ trợ sự kiện qua mạng xã hội. Ngày 14/09/2026, khi đến Cơ sở lưu trú An Phúc theo lịch hẹn, chị Mai gặp ông Trần Quốc Hưng và bà Lê Thảo Vy. Tại đây, bà Vy yêu cầu chị Mai đi cùng một vị khách vào phòng riêng trái với mô tả công việc ban đầu. Chị Mai từ chối và yêu cầu rời đi nhưng bị cản trở, gây tổn hại nghiêm trọng về tinh thần và danh dự.',
  full_document: `HỒ SƠ TÓM TẮT VỤ ÁN DÂN SỰ SƠ THẨM (KẾT HỢP TÀI LIỆU XÁC MINH TỪ CƠ QUAN ĐIỀU TRA)

1. Bối cảnh và diễn biến sự việc trước khi khởi kiện:
Ngày 12/09/2026, chị Nguyễn Ngọc Mai nhìn thấy một bài đăng tuyển nhân viên hỗ trợ sự kiện ngắn hạn với mức thù lao theo ca. Theo thông tin liên hệ trên bài đăng, chị Mai đã nhắn tin trao đổi và được hẹn đến nhận việc vào chiều ngày 14/09/2026.
Ngày 14/09/2026, chị Nguyễn Ngọc Mai đến địa điểm được chỉ dẫn là Cơ sở lưu trú An Phúc. Tại sảnh tầng 2 của cơ sở này, chị Mai gặp một người đàn ông tự xưng là Trần Quốc Hưng và một người phụ nữ tự xưng là Lê Thảo Vy (quản lý điều phối). Sau khi thu giữ thẻ căn cước để "đăng ký ca trực", bà Vy yêu cầu chị Mai phải đi cùng một vị khách vào phòng riêng số 204 để phục vụ đồ uống và tiếp khách riêng.
Ngay lập tức, chị Mai cảm thấy bất an và không đồng ý với yêu cầu này. Chị Mai đã từ chối và bày tỏ mong muốn được rời khỏi nơi đó ngay lập tức. Tuy nhiên, ông Hưng và bà Vy đã khóa cửa thông tầng trong khoảng 40 phút, lớn tiếng đe dọa phạt tiền hủy ca và xúc phạm danh dự chị Mai trước mặt nhiều người tại sảnh trước khi trả lại giấy tờ cho chị Mai ra về.
Ngày 15/09/2026, chị Nguyễn Ngọc Mai đã trình báo sự việc và lập Bản tường trình (Mã hồ sơ 02-BV/2026, đóng dấu CƠ QUAN ĐIỀU TRA HS-XX-26) trước sự tiếp nhận của Cán bộ điều tra Trương Văn Báu.
Không có dữ liệu ghi hình camera hành lang tầng 2 ngày 14/09/2026 do đầu ghi tại Cơ sở lưu trú An Phúc báo lỗi ổ cứng.

2. Yêu cầu khởi kiện của Nguyên đơn (chị Nguyễn Ngọc Mai):
Ngày 02/10/2026, chị Nguyễn Ngọc Mai nộp đơn khởi kiện tại Tòa án nhân dân có thẩm quyền, yêu cầu ông Trần Quốc Hưng và bà Lê Thảo Vy (đồng quản lý vận hành tại Cơ sở lưu trú An Phúc):
- Chấm dứt hành vi đăng tin tuyển dụng sai sự thật và công khai xin lỗi chị Nguyễn Ngọc Mai vì hành vi cản trở trái phép, xúc phạm danh dự, nhân phẩm ngày 14/09/2026.
- Liên đới bồi thường thiệt hại về chi phí điều trị tâm lý, thu nhập thực tế bị mất và tổn thất tinh thần tổng cộng là 45.000.000 đồng.

3. Ý kiến phản bác của Bị đơn (ông Trần Quốc Hưng và bà Lê Thảo Vy):
Phía bị đơn thừa nhận ngày 14/09/2026 chị Nguyễn Ngọc Mai có mặt tại Cơ sở lưu trú An Phúc theo lịch hẹn tuyển cộng tác viên sự kiện. Tuy nhiên, phía bị đơn cho rằng việc đề nghị chị Mai vào phòng 204 chỉ là mang nước tiếp khách hội thảo, hoàn toàn không có sự ép buộc hay giữ người trái ý muốn. Bị đơn phản đối mức bồi thường 45.000.000 đồng vì cho rằng chị Mai tự ý bỏ về giữa ca trực và chưa chứng minh được thiệt hại thực tế hợp lý.

4. Trọng tâm cần làm rõ tại phiên tòa ngày 18/11/2026:
- Giá trị chứng minh của Bản tường trình ngày 15/09/2026 của chị Nguyễn Ngọc Mai (02-BV/2026) khi đặt trong mối liên hệ với Biên bản xác minh hiện trường và lời khai của các bên.
- Hành vi của ông Hưng và bà Vy ngày 14/09/2026 có cấu thành hành vi trái pháp luật xâm phạm danh dự, nhân phẩm và quyền tự do cá nhân theo Điều 34, Điều 584 Bộ luật Dân sự 2015 hay không.
- Căn cứ xác định mức bồi thường thiệt hại thực tế và khoản bù đắp tổn thất tinh thần theo Điều 585, Điều 592 Bộ luật Dân sự 2015.`,
  evidence_absences: [
    {
      title: 'Dữ liệu camera hành lang tầng 2 ngày 14/09/2026 tại Cơ sở lưu trú An Phúc',
      source_quote: 'Không có dữ liệu ghi hình camera hành lang tầng 2 ngày 14/09/2026 do đầu ghi tại Cơ sở lưu trú An Phúc báo lỗi ổ cứng.'
    }
  ],
  parties: [
    {
      side: 'plaintiff',
      name: 'Nguyễn Ngọc Mai',
      claims: [
        'Yêu cầu ông Trần Quốc Hưng và bà Lê Thảo Vy công khai xin lỗi vì hành vi lừa dối tuyển dụng, giữ người cản trở việc rời đi và xúc phạm danh dự, nhân phẩm ngày 14/09/2026 tại Cơ sở lưu trú An Phúc.',
        'Yêu cầu liên đới bồi thường thiệt hại về chi phí khám điều trị rối loạn lo âu cấp tính, thu nhập bị mất và khoản tiền bù đắp tổn thất tinh thần tổng cộng 45.000.000 đồng.'
      ]
    },
    {
      side: 'defendant',
      name: 'Trần Quốc Hưng và Lê Thảo Vy (Cơ sở lưu trú An Phúc)',
      claims: [
        'Không chấp nhận yêu cầu bồi thường 45.000.000 đồng vì cho rằng chỉ phân công nhân viên phục vụ phòng họp riêng số 204, không có hành vi cưỡng ép hoặc giam giữ trái pháp luật.',
        'Đề nghị Tòa án bác các khoản chi phí không có hóa đơn tài chính hợp lệ và giảm trừ toàn bộ yêu cầu bù đắp tổn thất tinh thần.'
      ]
    }
  ],
  timeline: [
    {
      kind: 'transaction',
      date: '2026-09-12',
      date_to: '2026-09-12',
      description: 'Chị Nguyễn Ngọc Mai đọc bài đăng tuyển nhân viên hỗ trợ sự kiện và nhắn tin nhận lịch hẹn làm việc.',
      source_quote: 'Ngày 12/09/2026, chị Nguyễn Ngọc Mai nhìn thấy một bài đăng tuyển nhân viên hỗ trợ sự kiện ngắn hạn với mức thù lao theo ca.',
      status: 'reported'
    },
    {
      kind: 'conduct',
      date: '2026-09-14',
      date_to: '2026-09-14',
      description: 'Chị Mai đến Cơ sở lưu trú An Phúc, gặp ông Hưng và bà Vy, bị yêu cầu đi cùng khách vào phòng riêng và phát sinh việc cản trở khi chị từ chối rời đi.',
      source_quote: 'Ngày 14/09/2026, chị Nguyễn Ngọc Mai đến địa điểm được chỉ dẫn là Cơ sở lưu trú An Phúc.',
      status: 'reported'
    },
    {
      kind: 'dispute',
      date: '2026-09-15',
      date_to: '2026-09-15',
      description: 'Chị Nguyễn Ngọc Mai lập Bản tường trình số 02-BV/2026 tại Cơ quan điều tra trước Cán bộ điều tra Trương Văn Báu.',
      source_quote: 'Ngày 15/09/2026, chị Nguyễn Ngọc Mai đã trình báo sự việc và lập Bản tường trình (Mã hồ sơ 02-BV/2026, đóng dấu CƠ QUAN ĐIỀU TRA HS-XX-26) trước sự tiếp nhận của Cán bộ điều tra Trương Văn Báu.',
      status: 'reported'
    },
    {
      kind: 'filing',
      date: '2026-10-02',
      date_to: '2026-10-02',
      description: 'Chị Nguyễn Ngọc Mai nộp đơn khởi kiện yêu cầu xin lỗi công khai và bồi thường thiệt hại 45.000.000 đồng.',
      source_quote: 'Ngày 02/10/2026, chị Nguyễn Ngọc Mai nộp đơn khởi kiện tại Tòa án nhân dân có thẩm quyền',
      status: 'reported'
    },
    {
      kind: 'hearing',
      date: '2026-11-18',
      date_to: '2026-11-18',
      description: 'Tòa án mở phiên tòa xét xử sơ thẩm vụ án.',
      source_quote: 'Trọng tâm cần làm rõ tại phiên tòa ngày 18/11/2026',
      status: 'reported'
    }
  ],
  case_facts: [
    {
      kind: 'recorded_event',
      quote: 'Ngày 14/09/2026, chị Nguyễn Ngọc Mai đến địa điểm được chỉ dẫn là Cơ sở lưu trú An Phúc.',
      source_type: 'case_outline'
    },
    {
      kind: 'recorded_event',
      quote: 'Ngày 15/09/2026, chị Nguyễn Ngọc Mai đã trình báo sự việc và lập Bản tường trình (Mã hồ sơ 02-BV/2026, đóng dấu CƠ QUAN ĐIỀU TRA HS-XX-26) trước sự tiếp nhận của Cán bộ điều tra Trương Văn Báu.',
      source_type: 'case_outline'
    },
    {
      kind: 'unproven',
      quote: 'Không có dữ liệu ghi hình camera hành lang tầng 2 ngày 14/09/2026 do đầu ghi tại Cơ sở lưu trú An Phúc báo lỗi ổ cứng.',
      source_type: 'case_outline'
    },
    {
      kind: 'party_statement',
      party: 'Bị đơn Trần Quốc Hưng và Lê Thảo Vy',
      quote: 'Tuy nhiên, phía bị đơn cho rằng việc đề nghị chị Mai vào phòng 204 chỉ là mang nước tiếp khách hội thảo, hoàn toàn không có sự ép buộc hay giữ người trái ý muốn.',
      source_type: 'case_outline'
    }
  ],
  evidence_inventory: [
    {
      id: 'EV-anphuc-tuongtrinh',
      name: 'Bản tường trình của Nguyễn Ngọc Mai (Mã số 02-BV/2026)',
      availability: 'provided',
      date: '2026-09-15',
      provided_by: 'Nguyễn Ngọc Mai',
      source_kind: 'document',
      source_locator: 'Bút lục số 02-BV/2026 - Dấu đỏ CƠ QUAN ĐIỀU TRA HS-XX-26',
      proof_scope: 'Ghi nhận lời trình bày trực tiếp của chị Nguyễn Ngọc Mai ngay sau sự việc ngày 14/09/2026 tại Cơ sở lưu trú An Phúc dưới sự tiếp nhận của Cán bộ điều tra Trương Văn Báu.',
      summary: 'Bản tường trình lập ngày 15/09/2026 của Nguyễn Ngọc Mai về việc ứng tuyển hỗ trợ sự kiện ngày 12/09/2026, đến Cơ sở lưu trú An Phúc ngày 14/09/2026 gặp Hưng và Vy, bị Vy yêu cầu đi cùng khách vào phòng riêng và đã lập tức từ chối, yêu cầu rời khỏi đó.',
      source_quote: 'Ngày 15/09/2026, chị Nguyễn Ngọc Mai đã trình báo sự việc và lập Bản tường trình (Mã hồ sơ 02-BV/2026, đóng dấu CƠ QUAN ĐIỀU TRA HS-XX-26) trước sự tiếp nhận của Cán bộ điều tra Trương Văn Báu.',
      content: `BẢN TƯỜNG TRÌNH CỦA NGUYỄN NGỌC MAI
Mã hồ sơ: 02-BV/2026
Thời điểm lập: 15/09/2026
Người trình bày: Nguyễn Ngọc Mai

Nội dung tường trình:
Ngày 12/09/2026, tôi có nhìn thấy một bài đăng tuyển nhân viên hỗ trợ sự kiện. Theo thông tin, tôi đã liên lạc và được hẹn.
Ngày 14/09/2026, tôi đến địa điểm được chỉ dẫn là Cơ sở lưu trú An Phúc. Tại đây, tôi gặp một người đàn ông, người này tự xưng là Hưng và Vy. Sau đó, Vy yêu cầu tôi phải đi cùng một vị khách vào phòng riêng. Ngay lập tức, tôi cảm thấy bất an và không đồng ý với yêu cầu này. Tôi đã từ chối và bày tỏ mong muốn được rời khỏi nơi đó ngay lập tức.

Chữ ký người trình bày: Nguyễn Ngọc Mai
Họ và tên: NGUYỄN NGỌC MAI
Người tiếp nhận tường trình: Trương Văn Báu - Cán bộ điều tra
Xác nhận đóng dấu: CƠ QUAN ĐIỀU TRA ★ HS-XX-26`
    },
    {
      id: 'EV-anphuc-vibang',
      name: 'Vi bằng ghi nhận bài đăng tuyển dụng và tin nhắn hẹn ngày 12/09/2026',
      availability: 'provided',
      date: '2026-09-12',
      provided_by: 'Nguyễn Ngọc Mai',
      source_kind: 'document',
      source_locator: 'Bút lục số 05-VB/2026 - Văn phòng Thừa phát lại',
      proof_scope: 'Chứng minh nội dung thông báo tuyển dụng ban đầu chỉ nêu công việc đón khách lễ tân hội thảo, hoàn toàn khác với yêu cầu vào phòng riêng số 204 tại Cơ sở lưu trú An Phúc.',
      summary: 'Vi bằng ghi nhận nguyên trạng bài đăng tuyển dụng ngày 12/09/2026 và đoạn tin nhắn tài khoản Lê Thảo Vy hẹn chị Mai đến Cơ sở lưu trú An Phúc lúc 14 giờ 00 ngày 14/09/2026.',
      source_quote: 'Ngày 12/09/2026, chị Nguyễn Ngọc Mai nhìn thấy một bài đăng tuyển nhân viên hỗ trợ sự kiện ngắn hạn với mức thù lao theo ca.',
      content: `VI BẰNG GHI NHẬN NỘI DUNG TIN NHẮN & BÀI ĐĂNG TUYỂN DỤNG
Thời điểm ghi nhận sự kiện: 12/09/2026
Người yêu cầu lập: Nguyễn Ngọc Mai

1. Nội dung bài đăng ngày 12/09/2026: "Cần tuyển 02 bạn nữ hỗ trợ lễ tân check-in sự kiện hội thảo doanh nghiệp ngày 14/09/2026 tại khu vực An Phúc. Công việc: phát tài liệu và hướng dẫn đại biểu tại sảnh chung. Thù lao: 600.000 đồng/ca."
2. Tin nhắn xác nhận lúc 19h15 ngày 12/09/2026 từ tài khoản "Vy Lê (Quản lý An Phúc)": "Em đến tầng 2 Cơ sở lưu trú An Phúc lúc 14h00 ngày 14/09/2026 gặp anh Hưng và chị Vy để nhận thẻ cộng tác viên nhé."`
    },
    {
      id: 'EV-anphuc-xacminh',
      name: 'Biên bản xác minh hiện trường tại Cơ sở lưu trú An Phúc',
      availability: 'provided',
      date: '2026-09-15',
      provided_by: 'Cơ quan điều tra - Cán bộ Trương Văn Báu',
      source_kind: 'document',
      source_locator: 'Bút lục số 08-BBXM/2026 - CƠ QUAN ĐIỀU TRA HS-XX-26',
      proof_scope: 'Xác nhận cấu trúc cửa khóa từ tầng 2, sổ ghi chép giữ giấy tờ tùy thân và lời khai của nhân viên bảo vệ về việc to tiếng chiều ngày 14/09/2026.',
      summary: 'Biên bản xác minh ngày 15/09/2026 của Cán bộ điều tra Trương Văn Báu ghi nhận tại Cơ sở lưu trú An Phúc ngày 14/09/2026 không có hội thảo doanh nghiệp nào được tổ chức, phòng 204 là phòng nghỉ lưu trú theo giờ và cửa thông tầng 2 có chốt khóa điện từ bên trong.',
      source_quote: 'Tuy nhiên, ông Hưng và bà Vy đã khóa cửa thông tầng trong khoảng 40 phút, lớn tiếng đe dọa phạt tiền hủy ca và xúc phạm danh dự chị Mai trước mặt nhiều người tại sảnh trước khi trả lại giấy tờ cho chị Mai ra về.',
      content: `BIÊN BẢN XÁC MINH HIỆN TRƯỜNG & SỔ LƯU TRÚ
Thời điểm lập: 15/09/2026
Cán bộ lập biên bản: Trương Văn Báu - Cán bộ điều tra (Mã hồ sơ HS-XX-26)

Kết quả kiểm tra thực tế tại Cơ sở lưu trú An Phúc:
1. Kiểm tra sổ đăng ký hoạt động ngày 14/09/2026: Tại Cơ sở lưu trú An Phúc không có bất kỳ chương trình hội thảo doanh nghiệp nào đăng ký tổ chức. Phòng số 204 là phòng lưu trú khép kín do một khách nam thuê theo giờ lúc 13h50 ngày 14/09/2026.
2. Kiểm tra hiện trường sảnh tầng 2: Lối xuống cầu thang bộ có lắp cửa kính khóa từ điều khiển tại quầy của ông Trần Quốc Hưng.
3. Lời trình bày của nhân viên bảo vệ tầng 1 (ông Phạm Văn Tấn): Khoảng 14h30 đến 15h10 ngày 14/09/2026, ông Tấn nghe tiếng chị Nguyễn Ngọc Mai đập cửa yêu cầu mở khóa để ra về và tiếng bà Vy lớn tiếng mạt sát chị Mai về việc "tự ý hủy kèo tiếp khách".`
    },
    {
      id: 'EV-anphuc-loikhai',
      name: 'Biên bản ghi lời khai của Trần Quốc Hưng và Lê Thảo Vy, kèm Hồ sơ y tế và chứng từ thiệt hại',
      availability: 'provided',
      date: '2026-09-18',
      provided_by: 'Cơ quan điều tra & Bệnh viện Đa khoa Khu vực',
      source_kind: 'document',
      source_locator: 'Bút lục số 11-BBLK/2026 & Hóa đơn viện phí ngày 16/09/2026',
      proof_scope: 'Đối chiếu lời thừa nhận một phần của bị đơn và chứng từ chi phí điều trị y tế thực tế của nguyên đơn.',
      verification_status: 'conflicting',
      summary: 'Ông Hưng và bà Vy thừa nhận có giữ căn cước công dân của chị Mai và yêu cầu chị vào phòng 204 nhưng phủ nhận việc ép buộc. Kèm theo là Giấy xác nhận khám điều trị rối loạn lo âu cấp tính và hóa đơn y tế 12.500.000 đồng của chị Mai.',
      source_quote: 'Phía bị đơn thừa nhận ngày 14/09/2026 chị Nguyễn Ngọc Mai có mặt tại Cơ sở lưu trú An Phúc theo lịch hẹn tuyển cộng tác viên sự kiện.',
      content: `TRÍCH BIÊN BẢN GHI LỜI KHAI ĐỐI CHẤT & CHỨNG TỪ THIỆT HẠI
Thời điểm lập: 18/09/2026

1. Lời khai của bà Lê Thảo Vy và ông Trần Quốc Hưng:
- Thừa nhận ngày 14/09/2026 có tạm giữ thẻ Căn cước công dân của chị Nguyễn Ngọc Mai tại quầy tầng 2 và có yêu cầu chị Mai vào phòng riêng số 204 cùng khách lưu trú.
- Thừa nhận có đóng cửa kính tầng 2 trong lúc "nói chuyện giải quyết bất đồng" khoảng 30-40 phút nhưng cho rằng mục đích là để yêu cầu chị Mai bồi hoàn chi phí điều phối ca trực.
2. Chứng từ thiệt hại do chị Nguyễn Ngọc Mai cung cấp:
- Hồ sơ bệnh án ngoại trú ngày 16/09/2026 tại Khoa Tâm thần kinh - Bệnh viện Đa khoa: Chẩn đoán "Phản ứng sang chấn tâm lý và rối loạn lo âu cấp tính sau sự cố", hóa đơn viện phí và thuốc điều trị có chứng từ hợp lệ là 12.500.000 đồng.
- Khoản thu nhập thực tế bị mất trong 15 ngày nghỉ điều trị theo xác nhận nơi làm việc chính thức: 7.500.000 đồng.
- Khoản yêu cầu bù đắp tổn thất tinh thần: 25.000.000 đồng (tổng cộng yêu cầu khởi kiện là 45.000.000 đồng).`
    }
  ]
};

export const caseLaborSaoKhue = {
  _id: '6ac100000000000000000004',
  title: 'Tranh chấp đơn phương chấm dứt hợp đồng lao động và chi phí đào tạo giữa ông Đặng Minh Quân và Công ty Sao Khuê',
  category: 'Lao động - Tranh chấp đơn phương chấm dứt HĐLĐ & Chi phí đào tạo',
  reference_date: '2024-04-20',
  reference_date_note: 'Mốc ngày 20/04/2024 là ngày Công ty Cổ phần Phần mềm Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK chấm dứt hợp đồng lao động với ông Đặng Minh Quân.',
  legal_scope_note: 'Đối chiếu quy định về quyền đơn phương chấm dứt hợp đồng lao động của người sử dụng lao động (Điều 36 Bộ luật Lao động 2019), nghĩa vụ của người sử dụng lao động khi đơn phương chấm dứt hợp đồng lao động trái pháp luật (Điều 41 Bộ luật Lao động 2019), hợp đồng đào tạo nghề và hoàn trả chi phí đào tạo (Điều 62 Bộ luật Lao động 2019).',
  summary: 'Ông Đặng Minh Quân làm việc tại Công ty Cổ phần Phần mềm Sao Khuê theo Hợp đồng lao động xác định thời hạn 36 tháng. Ngày 20/04/2024, Công ty ban hành Quyết định số 09/2024/QĐ-SK đơn phương chấm dứt hợp đồng lao động với lý do ông Quân không hoàn thành công việc và yêu cầu ông Quân hoàn trả 180.000.000 đồng chi phí khóa đào tạo chuyên gia AI. Ông Quân khởi kiện yêu cầu tuyên hủy quyết định sa thải trái luật, bồi thường tiền lương những ngày không được làm việc và bác yêu cầu hoàn trả chi phí đào tạo.',
  full_document: `HỒ SƠ TÓM TẮT VỤ ÁN TRANH CHẤP LAO ĐỘNG SƠ THẨM

1. Quan hệ lao động và cam kết đào tạo:
Ngày 10/01/2023, ông Đặng Minh Quân và Công ty Cổ phần Phần mềm Sao Khuê ký Hợp đồng lao động số 18/2023/HĐLĐ-SK có thời hạn 36 tháng (từ 10/01/2023 đến 10/01/2026), chức danh Kỹ sư phát triển hệ thống AI, mức lương theo hợp đồng là 30.000.000 đồng/tháng.
Ngày 15/06/2023, hai bên ký Thỏa thuận đào tạo số 04/2023/TTĐT-SK, theo đó Công ty cử ông Quân tham gia khóa đào tạo kiến trúc mô hình ngôn ngữ lớn trong 03 tháng với chi phí ghi trong thỏa thuận là 180.000.000 đồng, kèm điều khoản ông Quân cam kết làm việc tối thiểu 24 tháng sau khi hoàn thành khóa học. Nếu ông Quân tự ý nghỉ việc hoặc bị chấm dứt hợp đồng do lỗi của người lao động trước thời hạn cam kết thì phải hoàn trả toàn bộ chi phí đào tạo.

2. Diễn biến chấm dứt hợp đồng lao động:
Ngày 05/04/2024, Trưởng phòng Kỹ thuật lập Biên bản đánh giá kết quả công việc Quý I/2024, ghi nhận dự án tích hợp AI do nhóm ông Quân phụ trách chậm tiến độ 14 ngày.
Không có Quy chế đánh giá mức độ hoàn thành công việc được ban hành hợp pháp sau khi tham khảo ý kiến tổ chức đại diện người lao động tại cơ sở.
Ngày 20/04/2024, Giám đốc Công ty Cổ phần Phần mềm Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK đơn phương chấm dứt hợp đồng lao động đối với ông Đặng Minh Quân kể từ ngày 25/04/2024 với lý do "không hoàn thành nhiệm vụ theo Hợp đồng lao động" và chỉ báo trước 05 ngày làm việc.

3. Yêu cầu khởi kiện và yêu cầu phản tố:
Ngày 15/05/2024, ông Đặng Minh Quân khởi kiện tại Tòa án nhân dân yêu cầu:
- Tuyên Quyết định số 09/2024/QĐ-SK ngày 20/04/2024 là đơn phương chấm dứt hợp đồng lao động trái pháp luật.
- Buộc Công ty Sao Khuê thanh toán tiền lương trong những ngày không được làm việc, bồi thường thêm 02 tháng tiền lương theo hợp đồng và tiền vi phạm thời hạn báo trước tổng cộng là 195.000.000 đồng.
Phía Công ty Cổ phần Phần mềm Sao Khuê có yêu cầu phản tố buộc ông Đặng Minh Quân hoàn trả 180.000.000 đồng chi phí đào tạo theo Thỏa thuận số 04/2023/TTĐT-SK.

4. Trọng tâm tranh tụng tại phiên tòa ngày 20/08/2024:
- Điều kiện hợp pháp để người sử dụng lao động đơn phương chấm dứt HĐLĐ vì lý do "thường xuyên không hoàn thành công việc" theo điểm a khoản 1 Điều 36 Bộ luật Lao động 2019 (cần có Quy chế đánh giá và từ 02 lần đánh giá hay không, thời hạn báo trước 30 ngày).
- Khi người sử dụng lao động đơn phương chấm dứt HĐLĐ trái pháp luật thì người lao động có nghĩa vụ hoàn trả chi phí đào tạo theo Điều 62 Bộ luật Lao động 2019 hay không, và hóa đơn thực tế chứng minh chi phí đào tạo là bao nhiêu.`,
  evidence_absences: [
    {
      title: 'Quy chế đánh giá mức độ hoàn thành công việc có tham khảo ý kiến tổ chức đại diện người lao động',
      source_quote: 'Không có Quy chế đánh giá mức độ hoàn thành công việc được ban hành hợp pháp sau khi tham khảo ý kiến tổ chức đại diện người lao động tại cơ sở.'
    }
  ],
  parties: [
    {
      side: 'plaintiff',
      name: 'Ông Đặng Minh Quân (Người lao động)',
      claims: [
        'Yêu cầu tuyên Quyết định chấm dứt hợp đồng lao động số 09/2024/QĐ-SK ngày 20/04/2024 của Công ty Sao Khuê là trái pháp luật do không có quy chế đánh giá hợp pháp, chỉ mới đánh giá 01 quý và vi phạm thời hạn báo trước 30 ngày.',
        'Yêu cầu Công ty bồi thường tổng cộng 195.000.000 đồng và bác toàn bộ yêu cầu phản tố đòi 180.000.000 đồng chi phí đào tạo vì Công ty mới là bên tự ý chấm dứt hợp đồng trái luật.'
      ]
    },
    {
      side: 'defendant',
      name: 'Công ty Cổ phần Phần mềm Sao Khuê (Người sử dụng lao động)',
      claims: [
        'Giữ nguyên Quyết định chấm dứt hợp đồng lao động số 09/2024/QĐ-SK vì ông Quân để dự án trọng điểm Quý I/2024 trễ hạn 14 ngày gây ảnh hưởng kế hoạch kinh doanh.',
        'Yêu cầu phản tố buộc ông Đặng Minh Quân hoàn trả 180.000.000 đồng chi phí khóa đào tạo AI do chưa làm đủ 24 tháng cam kết theo Thỏa thuận số 04/2023/TTĐT-SK.'
      ]
    }
  ],
  timeline: [
    {
      kind: 'transaction',
      date: '2023-01-10',
      date_to: '2023-01-10',
      description: 'Ông Đặng Minh Quân và Công ty Sao Khuê ký Hợp đồng lao động số 18/2023/HĐLĐ-SK thời hạn 36 tháng.',
      source_quote: 'Ngày 10/01/2023, ông Đặng Minh Quân và Công ty Cổ phần Phần mềm Sao Khuê ký Hợp đồng lao động số 18/2023/HĐLĐ-SK có thời hạn 36 tháng',
      status: 'reported'
    },
    {
      kind: 'transaction',
      date: '2023-06-15',
      date_to: '2023-06-15',
      description: 'Hai bên ký Thỏa thuận đào tạo số 04/2023/TTĐT-SK với cam kết làm việc 24 tháng sau đào tạo.',
      source_quote: 'Ngày 15/06/2023, hai bên ký Thỏa thuận đào tạo số 04/2023/TTĐT-SK',
      status: 'reported'
    },
    {
      kind: 'conduct',
      date: '2024-04-05',
      date_to: '2024-04-05',
      description: 'Trưởng phòng Kỹ thuật lập Biên bản đánh giá kết quả công việc Quý I/2024 ghi nhận dự án chậm 14 ngày.',
      source_quote: 'Ngày 05/04/2024, Trưởng phòng Kỹ thuật lập Biên bản đánh giá kết quả công việc Quý I/2024, ghi nhận dự án tích hợp AI do nhóm ông Quân phụ trách chậm tiến độ 14 ngày.',
      status: 'reported'
    },
    {
      kind: 'dispute',
      date: '2024-04-20',
      date_to: '2024-04-20',
      description: 'Công ty Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK chấm dứt HĐLĐ với ông Quân kể từ ngày 25/04/2024.',
      source_quote: 'Ngày 20/04/2024, Giám đốc Công ty Cổ phần Phần mềm Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK đơn phương chấm dứt hợp đồng lao động đối với ông Đặng Minh Quân kể từ ngày 25/04/2024',
      status: 'reported'
    },
    {
      kind: 'filing',
      date: '2024-05-15',
      date_to: '2024-05-15',
      description: 'Ông Đặng Minh Quân nộp đơn khởi kiện tại Tòa án nhân dân.',
      source_quote: 'Ngày 15/05/2024, ông Đặng Minh Quân khởi kiện tại Tòa án nhân dân yêu cầu',
      status: 'reported'
    },
    {
      kind: 'hearing',
      date: '2024-08-20',
      date_to: '2024-08-20',
      description: 'Tòa án mở phiên tòa xét xử sơ thẩm vụ án tranh chấp lao động.',
      source_quote: 'Trọng tâm tranh tụng tại phiên tòa ngày 20/08/2024',
      status: 'reported'
    }
  ],
  case_facts: [
    {
      kind: 'recorded_event',
      quote: 'Ngày 10/01/2023, ông Đặng Minh Quân và Công ty Cổ phần Phần mềm Sao Khuê ký Hợp đồng lao động số 18/2023/HĐLĐ-SK có thời hạn 36 tháng (từ 10/01/2023 đến 10/01/2026), chức danh Kỹ sư phát triển hệ thống AI, mức lương theo hợp đồng là 30.000.000 đồng/tháng.',
      source_type: 'case_outline'
    },
    {
      kind: 'recorded_event',
      quote: 'Ngày 20/04/2024, Giám đốc Công ty Cổ phần Phần mềm Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK đơn phương chấm dứt hợp đồng lao động đối với ông Đặng Minh Quân kể từ ngày 25/04/2024 với lý do "không hoàn thành nhiệm vụ theo Hợp đồng lao động" và chỉ báo trước 05 ngày làm việc.',
      source_type: 'case_outline'
    },
    {
      kind: 'unproven',
      quote: 'Không có Quy chế đánh giá mức độ hoàn thành công việc được ban hành hợp pháp sau khi tham khảo ý kiến tổ chức đại diện người lao động tại cơ sở.',
      source_type: 'case_outline'
    }
  ],
  evidence_inventory: [
    {
      id: 'EV-saokhue-hdld',
      name: 'Hợp đồng lao động số 18/2023/HĐLĐ-SK ngày 10/01/2023',
      availability: 'provided',
      date: '2023-01-10',
      provided_by: 'Ông Đặng Minh Quân',
      source_kind: 'document',
      source_locator: 'Bút lục số 01-LĐ/2024',
      proof_scope: 'Xác định loại hợp đồng lao động xác định thời hạn 36 tháng, mức lương cơ bản 30.000.000 đồng/tháng và quyền, nghĩa vụ các bên.',
      summary: 'Hợp đồng lao động xác định thời hạn 36 tháng giữa Công ty Sao Khuê và ông Đặng Minh Quân, mức lương 30.000.000 đồng/tháng.',
      source_quote: 'Ngày 10/01/2023, ông Đặng Minh Quân và Công ty Cổ phần Phần mềm Sao Khuê ký Hợp đồng lao động số 18/2023/HĐLĐ-SK có thời hạn 36 tháng',
      content: `HỢP ĐỒNG LAO ĐỘNG SỐ 18/2023/HĐLĐ-SK
Ngày ký: 10/01/2023
Bên sử dụng lao động: Công ty Cổ phần Phần mềm Sao Khuê
Người lao động: Ông Đặng Minh Quân
Điều 1. Loại hợp đồng: Hợp đồng lao động xác định thời hạn 36 tháng (từ ngày 10/01/2023 đến hết ngày 10/01/2026).
Điều 2. Chức danh chuyên môn: Kỹ sư phát triển hệ thống Trí tuệ nhân tạo (AI Engineer).
Điều 3. Tiền lương: 30.000.000 đồng/tháng, trả vào ngày 05 hằng tháng.
Điều 5. Chấm dứt hợp đồng: Việc đơn phương chấm dứt hợp đồng lao động của mỗi bên phải tuân thủ đúng căn cứ và thời hạn báo trước ít nhất 30 ngày theo Điều 35, Điều 36 Bộ luật Lao động 2019.`
    },
    {
      id: 'EV-saokhue-daotao',
      name: 'Thỏa thuận đào tạo số 04/2023/TTĐT-SK và Chứng từ thanh toán học phí',
      availability: 'provided',
      date: '2023-06-15',
      provided_by: 'Công ty Cổ phần Phần mềm Sao Khuê',
      source_kind: 'document',
      source_locator: 'Bút lục số 04-LĐ/2024',
      proof_scope: 'Xác định điều kiện phát sinh nghĩa vụ hoàn trả chi phí đào tạo và đối chiếu số tiền thực chi có hóa đơn hợp lệ.',
      verification_status: 'conflicting',
      summary: 'Thỏa thuận đào tạo ghi mức chi phí dự kiến 180.000.000 đồng và chỉ buộc hoàn trả khi người lao động tự ý nghỉ việc hoặc bị sa thải đúng pháp luật, trong khi hóa đơn chuyển khoản học phí thực tế chỉ có 95.000.000 đồng.',
      source_quote: 'Ngày 15/06/2023, hai bên ký Thỏa thuận đào tạo số 04/2023/TTĐT-SK, theo đó Công ty cử ông Quân tham gia khóa đào tạo kiến trúc mô hình ngôn ngữ lớn trong 03 tháng với chi phí ghi trong thỏa thuận là 180.000.000 đồng',
      content: `THỎA THUẬN ĐÀO TẠO SỐ 04/2023/TTĐT-SK & CHỨNG TỪ KẾ TOÁN
Ngày lập: 15/06/2023

1. Nội dung Điều 3 Thỏa thuận số 04/2023/TTĐT-SK:
"Người lao động cam kết làm việc cho Công ty tối thiểu 24 tháng kể từ ngày kết thúc khóa đào tạo (15/09/2023). Trường hợp Người lao động đơn phương chấm dứt hợp đồng trái pháp luật hoặc bị Công ty xử lý kỷ luật sa thải, đơn phương chấm dứt hợp đồng hợp pháp do lỗi của Người lao động trước thời hạn 24 tháng thì phải hoàn trả chi phí đào tạo."
2. Đối chiếu chứng từ kế toán kèm theo:
- Tổng số tiền ghi khái toán trong văn bản thỏa thuận: 180.000.000 đồng.
- Hóa đơn giá trị gia tăng và ủy nhiệm chi thực tế Công ty thanh toán cho Học viện Đào tạo Công nghệ: 95.000.000 đồng (khoản chênh lệch 85.000.000 đồng Công ty tự kê khai là chi phí quản lý nội bộ nhưng không có chứng từ).`
    },
    {
      id: 'EV-saokhue-danhgia',
      name: 'Biên bản đánh giá kết quả công việc Quý I/2024 ngày 05/04/2024',
      availability: 'provided',
      date: '2024-04-05',
      provided_by: 'Công ty Cổ phần Phần mềm Sao Khuê',
      source_kind: 'document',
      source_locator: 'Bút lục số 07-LĐ/2024',
      proof_scope: 'Làm rõ việc đánh giá chỉ diễn ra 01 lần duy nhất và nguyên nhân chậm tiến độ có yếu tố khách quan từ phía hạ tầng máy chủ.',
      summary: 'Biên bản ngày 05/04/2024 ghi nhận dự án chậm 14 ngày nhưng có ý kiến của ông Quân về việc Công ty bàn giao máy chủ GPU chậm 10 ngày và Công ty chưa ban hành Quy chế đánh giá mức độ hoàn thành công việc.',
      source_quote: 'Ngày 05/04/2024, Trưởng phòng Kỹ thuật lập Biên bản đánh giá kết quả công việc Quý I/2024, ghi nhận dự án tích hợp AI do nhóm ông Quân phụ trách chậm tiến độ 14 ngày.',
      content: `BIÊN BẢN ĐÁNH GIÁ MỨC ĐỘ HOÀN THÀNH CÔNG VIỆC QUÝ I/2024
Thời điểm lập: 05/04/2024
Người lập: Trần Hải Đăng - Trưởng phòng Kỹ thuật

1. Nhận xét của Trưởng phòng: Phân hệ tích hợp AI của nhóm ông Đặng Minh Quân bàn giao chậm 14 ngày so với kế hoạch nội bộ đầu quý. Xếp loại Quý I/2024: Chưa hoàn thành tiến độ. (Các quý năm 2023 ông Quân đều xếp loại Hoàn thành tốt).
2. Ý kiến bảo lưu của ông Đặng Minh Quân ngay trong biên bản: "Nguyên nhân chậm 14 ngày là do bộ phận Hạ tầng của Công ty cấp cụm máy chủ GPU trễ 10 ngày và thay đổi yêu cầu dữ liệu đầu vào. Ngoài ra Công ty chưa từng ban hành Quy chế đánh giá mức độ hoàn thành công việc theo Điều 36 Bộ luật Lao động 2019."`
    },
    {
      id: 'EV-saokhue-quyetdinh',
      name: 'Quyết định chấm dứt hợp đồng lao động số 09/2024/QĐ-SK ngày 20/04/2024',
      availability: 'provided',
      date: '2024-04-20',
      provided_by: 'Công ty Cổ phần Phần mềm Sao Khuê',
      source_kind: 'document',
      source_locator: 'Bút lục số 09-LĐ/2024',
      proof_scope: 'Chứng minh căn cứ chấm dứt HĐLĐ và thời gian báo trước thực tế chỉ có 05 ngày (từ 20/04/2024 đến 25/04/2024).',
      summary: 'Quyết định số 09/2024/QĐ-SK ký ngày 20/04/2024 chấm dứt HĐLĐ với ông Quân từ ngày 25/04/2024 (báo trước 05 ngày) và yêu cầu khấu trừ lương, đòi hoàn trả 180.000.000 đồng chi phí đào tạo.',
      source_quote: 'Ngày 20/04/2024, Giám đốc Công ty Cổ phần Phần mềm Sao Khuê ban hành Quyết định số 09/2024/QĐ-SK đơn phương chấm dứt hợp đồng lao động đối với ông Đặng Minh Quân kể từ ngày 25/04/2024',
      content: `QUYẾT ĐỊNH SỐ 09/2024/QĐ-SK
Về việc đơn phương chấm dứt Hợp đồng lao động
Thời điểm ban hành: 20/04/2024

GIÁM ĐỐC CÔNG TY CỔ PHẦN PHẦN MỀM SAO KHUÊ QUYẾT ĐỊNH:
Điều 1. Chấm dứt Hợp đồng lao động số 18/2023/HĐLĐ-SK đối với ông Đặng Minh Quân kể từ ngày 25/04/2024.
Lý do: Không hoàn thành nhiệm vụ được giao trong Quý I/2024 theo Biên bản ngày 05/04/2024.
Điều 2. Ông Đặng Minh Quân có trách nhiệm bàn giao công việc trước ngày 25/04/2024 và hoàn trả cho Công ty khoản chi phí đào tạo là 180.000.000 đồng theo Thỏa thuận số 04/2023/TTĐT-SK.`
    }
  ]
};

export const caseDepositContractThuDuc = {
  _id: '6ac100000000000000000005',
  title: 'Tranh chấp hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất và phạt cọc giữa bà Phạm Thu Hà và ông Võ Thành Nam',
  category: 'Dân sự - Tranh chấp hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất',
  reference_date: '2024-05-10',
  reference_date_note: 'Mốc ngày 10/05/2024 là thời hạn cuối cùng hai bên thỏa thuận ra Văn phòng Công chứng ký hợp đồng chuyển nhượng quyền sử dụng đất và phát sinh tranh chấp phạt cọc.',
  legal_scope_note: 'Đối chiếu quy định về điều kiện có hiệu lực của giao dịch dân sự (Điều 117 Bộ luật Dân sự 2015), giao dịch dân sự vô hiệu do nhầm lẫn hoặc lừa dối (Điều 126, Điều 127 Bộ luật Dân sự 2015), đặt cọc và xử lý tiền đặt cọc (Điều 328 Bộ luật Dân sự 2015) cùng nghĩa vụ cung cấp thông tin khi giao kết hợp đồng (Điều 387 Bộ luật Dân sự 2015).',
  summary: 'Ngày 10/03/2024, bà Phạm Thu Hà (bên đặt cọc) và ông Võ Thành Nam (bên nhận đặt cọc) ký Hợp đồng đặt cọc số tiền 500.000.000 đồng để đảm bảo giao kết hợp đồng chuyển nhượng thửa đất số 412, tờ bản đồ số 18, diện tích 120 m² với giá chuyển nhượng 4.500.000.000 đồng. Trước ngày công chứng 10/05/2024, bà Hà xin trích lục quy hoạch và phát hiện 42 m² của thửa đất nằm trong quy hoạch lộ giới đường dự phóng và hành lang cây xanh. Bà Hà từ chối ký hợp đồng công chứng và khởi kiện đòi lại 500.000.000 đồng tiền cọc cùng 500.000.000 đồng phạt cọc.',
  full_document: `HỒ SƠ TÓM TẮT VỤ ÁN DÂN SỰ SƠ THẨM VỀ TRANH CHẤP HỢP ĐỒNG ĐẶT CỌC

1. Giao kết hợp đồng đặt cọc và thanh toán tiền cọc:
Ngày 10/03/2024, bà Phạm Thu Hà và ông Võ Thành Nam ký Hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất đối với thửa đất số 412, tờ bản đồ số 18, diện tích 120 m² (theo Giấy chứng nhận quyền sử dụng đất cấp ngày 18/07/2019 đứng tên ông Võ Thành Nam). Giá chuyển nhượng thỏa thuận là 4.500.000.000 đồng.
Cùng ngày 10/03/2024, bà Hà đã chuyển khoản đủ số tiền đặt cọc là 500.000.000 đồng vào tài khoản ngân hàng của ông Võ Thành Nam. Theo Điều 3 của Hợp đồng đặt cọc, hai bên cam kết chậm nhất đến ngày 10/05/2024 sẽ có mặt tại Văn phòng Công chứng Đông Sài Gòn để ký Hợp đồng chuyển nhượng quyền sử dụng đất. Điều 4 Hợp đồng đặt cọc quy định: "Bên B (ông Nam) cam kết thửa đất không có tranh chấp, không bị kê biên và không nằm trong quy hoạch giải tỏa. Nếu Bên B vi phạm cam kết thì phải trả lại 500.000.000 đồng tiền cọc và chịu phạt cọc 500.000.000 đồng. Nếu Bên A (bà Hà) đổi ý không mua thì mất toàn bộ tiền đặt cọc."

2. Phát sinh tranh chấp về thông tin quy hoạch:
Ngày 02/05/2024, Chi nhánh Văn phòng Đăng ký đất đai ban hành Văn bản số 318/CNVPĐKĐĐ trả lời thông tin quy hoạch đối với thửa đất số 412, xác nhận: Trong tổng diện tích 120 m² của thửa đất số 412 có 42 m² thuộc quy hoạch lộ giới đường mở rộng và hành lang an toàn cây xanh theo Quyết định phê duyệt quy hoạch phân khu tỷ lệ 1/2000 ban hành từ năm 2022, phần diện tích 78 m² còn lại thuộc quy hoạch đất ở hiện hữu.
Không có văn bản thỏa thuận sửa đổi hợp đồng đặt cọc về việc giảm giá chuyển nhượng sau khi có kết quả trả lời quy hoạch ngày 02/05/2024.
Ngày 10/05/2024, tại Văn phòng Công chứng Đông Sài Gòn, bà Phạm Thu Hà có mặt và lập Vi bằng ghi nhận việc bà từ chối ký hợp đồng chuyển nhượng do thửa đất vướng quy hoạch 42 m² trái với cam kết tại Điều 4 Hợp đồng đặt cọc. Ông Võ Thành Nam cũng có mặt tại Văn phòng Công chứng với đầy đủ bản chính Giấy chứng nhận quyền sử dụng đất và yêu cầu bà Hà ký hợp đồng vì cho rằng đất chỉ mới có quy hoạch phân khu 1/2000, chưa có quyết định thu hồi đất hàng năm nên vẫn được phép chuyển nhượng bình thường.

3. Yêu cầu khởi kiện và ý kiến phản bác:
Ngày 28/05/2024, bà Phạm Thu Hà khởi kiện tại Tòa án nhân dân yêu cầu buộc ông Võ Thành Nam hoàn trả 500.000.000 đồng tiền đặt cọc và thanh toán 500.000.000 đồng tiền phạt cọc (tổng cộng 1.000.000.000 đồng).
Phía ông Võ Thành Nam phản đối toàn bộ yêu cầu khởi kiện, khẳng định trước khi ký đặt cọc đã giao bản chụp Giấy chứng nhận quyền sử dụng đất cho bà Hà tự kiểm tra, thửa đất hoàn toàn đủ điều kiện công chứng chuyển nhượng theo Luật Đất đai nên việc bà Hà từ chối ký hợp đồng là lỗi của bên đặt cọc, ông Nam có quyền thuộc về mình 500.000.000 đồng tiền cọc.

4. Trọng tâm tranh tụng tại phiên tòa ngày 12/09/2024:
- Giải thích nội dung cam kết "không nằm trong quy hoạch giải tỏa" tại Điều 4 Hợp đồng đặt cọc ngày 10/03/2024 và nghĩa vụ cung cấp thông tin theo Điều 387 Bộ luật Dân sự 2015.
- Xác định lỗi dẫn đến việc không giao kết được Hợp đồng chuyển nhượng quyền sử dụng đất ngày 10/05/2024 thuộc hoàn toàn về ông Nam, thuộc về bà Hà hay do lỗi hỗn hợp của cả hai bên (chỉ hoàn trả tiền cọc, không phạt cọc theo Điều 328 Bộ luật Dân sự 2015 và Án lệ/thực tiễn xét xử).`,
  evidence_absences: [
    {
      title: 'Phụ lục hoặc văn bản thỏa thuận điều chỉnh giá chuyển nhượng sau khi biết thông tin quy hoạch',
      source_quote: 'Không có văn bản thỏa thuận sửa đổi hợp đồng đặt cọc về việc giảm giá chuyển nhượng sau khi có kết quả trả lời quy hoạch ngày 02/05/2024.'
    }
  ],
  parties: [
    {
      side: 'plaintiff',
      name: 'Bà Phạm Thu Hà (Bên đặt cọc)',
      claims: [
        'Yêu cầu buộc ông Võ Thành Nam hoàn trả 500.000.000 đồng tiền đặt cọc và trả 500.000.000 đồng tiền phạt cọc (tổng cộng 1.000.000.000 đồng) do vi phạm cam kết tại Điều 4 Hợp đồng đặt cọc ngày 10/03/2024 khi 42 m²/120 m² thửa đất nằm trong quy hoạch lộ giới và cây xanh.',
        'Trường hợp Tòa án xác định lỗi hỗn hợp hoặc nhầm lẫn khách quan thì tối thiểu phải buộc ông Nam hoàn trả toàn bộ 500.000.000 đồng tiền đặt cọc đã nhận.'
      ]
    },
    {
      side: 'defendant',
      name: 'Ông Võ Thành Nam (Bên nhận đặt cọc)',
      claims: [
        'Không chấp nhận yêu cầu trả lại cọc và phạt cọc vì thửa đất số 412 chưa có quyết định thu hồi đất của cơ quan nhà nước có thẩm quyền, hoàn toàn đủ điều kiện chuyển nhượng tại Văn phòng Công chứng ngày 10/05/2024.',
        'Đề nghị Tòa án công nhận số tiền đặt cọc 500.000.000 đồng thuộc về ông Võ Thành Nam do bà Phạm Thu Hà tự ý từ chối giao kết hợp đồng công chứng.'
      ]
    }
  ],
  timeline: [
    {
      kind: 'transaction',
      date: '2024-03-10',
      date_to: '2024-03-10',
      description: 'Bà Phạm Thu Hà và ông Võ Thành Nam ký Hợp đồng đặt cọc và chuyển khoản 500.000.000 đồng đối với thửa đất số 412 (120 m²).',
      source_quote: 'Ngày 10/03/2024, bà Phạm Thu Hà và ông Võ Thành Nam ký Hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất đối với thửa đất số 412, tờ bản đồ số 18, diện tích 120 m²',
      status: 'reported'
    },
    {
      kind: 'conduct',
      date: '2024-05-02',
      date_to: '2024-05-02',
      description: 'Chi nhánh Văn phòng Đăng ký đất đai ban hành Văn bản số 318/CNVPĐKĐĐ xác nhận 42 m²/120 m² thửa đất thuộc quy hoạch lộ giới và cây xanh.',
      source_quote: 'Ngày 02/05/2024, Chi nhánh Văn phòng Đăng ký đất đai ban hành Văn bản số 318/CNVPĐKĐĐ trả lời thông tin quy hoạch đối với thửa đất số 412',
      status: 'reported'
    },
    {
      kind: 'dispute',
      date: '2024-05-10',
      date_to: '2024-05-10',
      description: 'Tại Văn phòng Công chứng Đông Sài Gòn, hai bên không ký được hợp đồng chuyển nhượng do bất đồng về phần diện tích 42 m² vướng quy hoạch.',
      source_quote: 'Ngày 10/05/2024, tại Văn phòng Công chứng Đông Sài Gòn, bà Phạm Thu Hà có mặt và lập Vi bằng ghi nhận việc bà từ chối ký hợp đồng chuyển nhượng',
      status: 'reported'
    },
    {
      kind: 'filing',
      date: '2024-05-28',
      date_to: '2024-05-28',
      description: 'Bà Phạm Thu Hà nộp đơn khởi kiện yêu cầu hoàn trả 500.000.000 đồng tiền cọc và 500.000.000 đồng phạt cọc.',
      source_quote: 'Ngày 28/05/2024, bà Phạm Thu Hà khởi kiện tại Tòa án nhân dân yêu cầu buộc ông Võ Thành Nam hoàn trả 500.000.000 đồng tiền đặt cọc và thanh toán 500.000.000 đồng tiền phạt cọc',
      status: 'reported'
    },
    {
      kind: 'hearing',
      date: '2024-09-12',
      date_to: '2024-09-12',
      description: 'Tòa án nhân dân mở phiên tòa xét xử sơ thẩm vụ án tranh chấp hợp đồng đặt cọc.',
      source_quote: 'Trọng tâm tranh tụng tại phiên tòa ngày 12/09/2024',
      status: 'reported'
    }
  ],
  case_facts: [
    {
      kind: 'recorded_event',
      quote: 'Cùng ngày 10/03/2024, bà Hà đã chuyển khoản đủ số tiền đặt cọc là 500.000.000 đồng vào tài khoản ngân hàng của ông Võ Thành Nam.',
      source_type: 'case_outline'
    },
    {
      kind: 'recorded_event',
      quote: 'Ngày 02/05/2024, Chi nhánh Văn phòng Đăng ký đất đai ban hành Văn bản số 318/CNVPĐKĐĐ trả lời thông tin quy hoạch đối với thửa đất số 412, xác nhận: Trong tổng diện tích 120 m² của thửa đất số 412 có 42 m² thuộc quy hoạch lộ giới đường mở rộng và hành lang an toàn cây xanh theo Quyết định phê duyệt quy hoạch phân khu tỷ lệ 1/2000 ban hành từ năm 2022, phần diện tích 78 m² còn lại thuộc quy hoạch đất ở hiện hữu.',
      source_type: 'case_outline'
    },
    {
      kind: 'unproven',
      quote: 'Không có văn bản thỏa thuận sửa đổi hợp đồng đặt cọc về việc giảm giá chuyển nhượng sau khi có kết quả trả lời quy hoạch ngày 02/05/2024.',
      source_type: 'case_outline'
    }
  ],
  evidence_inventory: [
    {
      id: 'EV-datcoc-hopdong',
      name: 'Hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất ngày 10/03/2024',
      availability: 'provided',
      date: '2024-03-10',
      provided_by: 'Bà Phạm Thu Hà',
      source_kind: 'document',
      source_locator: 'Bút lục số 01-DS/2024',
      proof_scope: 'Xác định nội dung thỏa thuận đặt cọc 500.000.000 đồng và điều khoản cam kết về tình trạng quy hoạch tại Điều 4.',
      summary: 'Hợp đồng đặt cọc ngày 10/03/2024 giữa bà Phạm Thu Hà và ông Võ Thành Nam đối với thửa đất 412 diện tích 120 m², giá 4.500.000.000 đồng, tiền cọc 500.000.000 đồng.',
      source_quote: 'Ngày 10/03/2024, bà Phạm Thu Hà và ông Võ Thành Nam ký Hợp đồng đặt cọc chuyển nhượng quyền sử dụng đất đối với thửa đất số 412, tờ bản đồ số 18, diện tích 120 m²',
      content: `HỢP ĐỒNG ĐẶT CỌC CHUYỂN NHƯỢNG QUYỀN SỬ DỤNG ĐẤT
Thời điểm lập: 10/03/2024
Bên đặt cọc (Bên A): Bà Phạm Thu Hà
Bên nhận đặt cọc (Bên B): Ông Võ Thành Nam

Điều 1. Đối tượng hợp đồng: Thửa đất số 412, tờ bản đồ số 18, diện tích 120 m² đất ở đô thị theo Giấy chứng nhận QSDĐ cấp ngày 18/07/2019.
Điều 2. Giá chuyển nhượng và tiền đặt cọc: Giá chuyển nhượng là 4.500.000.000 đồng. Bên A đặt cọc trước cho Bên B số tiền 500.000.000 đồng ngay khi ký hợp đồng này.
Điều 3. Thời hạn công chứng: Chậm nhất ngày 10/05/2024 tại Văn phòng Công chứng Đông Sài Gòn.
Điều 4. Cam kết của các bên: Bên B cam kết thửa đất thuộc quyền sử dụng hợp pháp, không có tranh chấp, không bị kê biên và không nằm trong quy hoạch giải tỏa. Nếu Bên B vi phạm cam kết hoặc từ chối chuyển nhượng thì phải hoàn trả 500.000.000 đồng tiền cọc và chịu phạt cọc 500.000.000 đồng. Nếu Bên A không tiến hành mua đúng hạn thì mất toàn bộ tiền đặt cọc.`
    },
    {
      id: 'EV-datcoc-saoke',
      name: 'Ủy nhiệm chi và Sao kê ngân hàng xác nhận chuyển khoản 500.000.000 đồng',
      availability: 'provided',
      date: '2024-03-10',
      provided_by: 'Bà Phạm Thu Hà',
      source_kind: 'document',
      source_locator: 'Bút lục số 03-DS/2024',
      proof_scope: 'Chứng minh bà Phạm Thu Hà đã thực hiện đầy đủ nghĩa vụ giao 500.000.000 đồng tiền đặt cọc cho ông Võ Thành Nam ngày 10/03/2024.',
      summary: 'Sao kê ngân hàng ngày 10/03/2024 xác nhận bà Phạm Thu Hà đã chuyển khoản thành công 500.000.000 đồng tiền đặt cọc mua thửa đất số 412 cho ông Võ Thành Nam.',
      source_quote: 'Cùng ngày 10/03/2024, bà Hà đã chuyển khoản đủ số tiền đặt cọc là 500.000.000 đồng vào tài khoản ngân hàng của ông Võ Thành Nam.',
      content: `GIẤY BÁO NỢ / SAO KÊ GIAO DỊCH NGÂN HÀNG
Ngày giao dịch: 10/03/2024 - Mã giao dịch: FT2407098812
Người chuyển tiền: PHAM THU HA
Người thụ hưởng: VO THANH NAM
Số tiền chuyển khoản: 500.000.000 VNĐ (Năm trăm triệu đồng chẵn)
Nội dung chuyển tiền: Pham Thu Ha dat coc chuyen nhuong thua dat so 412 to ban do 18 theo HD ngay 10/03/2024.`
    },
    {
      id: 'EV-datcoc-quyhoach',
      name: 'Văn bản số 318/CNVPĐKĐĐ cung cấp thông tin quy hoạch ngày 02/05/2024',
      availability: 'provided',
      date: '2024-05-02',
      provided_by: 'Chi nhánh Văn phòng Đăng ký đất đai',
      source_kind: 'document',
      source_locator: 'Bút lục số 06-DS/2024',
      proof_scope: 'Chứng minh 42 m²/120 m² thửa đất thuộc quy hoạch lộ giới đường mở rộng và hành lang cây xanh nhưng chưa có quyết định thu hồi đất.',
      summary: 'Văn bản số 318/CNVPĐKĐĐ ngày 02/05/2024 xác nhận thửa đất 412 (120 m²) có 42 m² nằm trong quy hoạch lộ giới đường dự phóng và cây xanh từ năm 2022, còn lại 78 m² đất ở, hiện chưa có quyết định thu hồi đất.',
      source_quote: 'Ngày 02/05/2024, Chi nhánh Văn phòng Đăng ký đất đai ban hành Văn bản số 318/CNVPĐKĐĐ trả lời thông tin quy hoạch đối với thửa đất số 412',
      content: `VĂN BẢN CUNG CẤP THÔNG TIN QUY HOẠCH SỬ DỤNG ĐẤT
Số: 318/CNVPĐKĐĐ - Ngày: 02/05/2024

Phúc đáp Phiếu yêu cầu cung cấp dữ liệu đất đai đối với thửa đất số 412, tờ bản đồ số 18 (diện tích 120 m²):
1. Căn cứ Quyết định phê duyệt đồ án quy hoạch phân khu tỷ lệ 1/2000 năm 2022:
- Phần diện tích 42,0 m² phía mặt tiền thửa đất thuộc quy hoạch lộ giới đường mở rộng và hành lang an toàn cây xanh cách ly.
- Phần diện tích 78,0 m² còn lại thuộc quy hoạch nhóm đất ở hiện hữu cải tạo.
2. Tình trạng pháp lý hiện tại: Tính đến ngày 02/05/2024, thửa đất số 412 chưa có Quyết định thu hồi đất và chưa nằm trong kế hoạch sử dụng đất thu hồi trong năm 2024, người sử dụng đất vẫn được thực hiện quyền chuyển nhượng nhưng không được cấp phép xây dựng mới kiên cố trên phần diện tích 42,0 m² thuộc quy hoạch lộ giới.`
    },
    {
      id: 'EV-datcoc-vibang',
      name: 'Vi bằng và Biên bản làm việc tại Văn phòng Công chứng ngày 10/05/2024',
      availability: 'provided',
      date: '2024-05-10',
      provided_by: 'Ông Võ Thành Nam & Bà Phạm Thu Hà',
      source_kind: 'document',
      source_locator: 'Bút lục số 09-DS/2024',
      proof_scope: 'Xác nhận cả hai bên đều có mặt đúng hẹn ngày 10/05/2024 và ghi nhận nguyên nhân không ký được hợp đồng công chứng.',
      summary: 'Biên bản ngày 10/05/2024 ghi nhận cả bà Hà và ông Nam đều có mặt tại Văn phòng Công chứng Đông Sài Gòn, ông Nam thừa nhận khi ký cọc cả hai bên đều chưa đi trích lục quy hoạch 1/2000.',
      source_quote: 'Ngày 10/05/2024, tại Văn phòng Công chứng Đông Sài Gòn, bà Phạm Thu Hà có mặt và lập Vi bằng ghi nhận việc bà từ chối ký hợp đồng chuyển nhượng',
      content: `VI BẰNG & BIÊN BẢN GHI NHẬN SỰ VIỆC TẠI VĂN PHÒNG CÔNG CHỨNG
Thời điểm lập: 09h30 ngày 10/05/2024
Địa điểm: Văn phòng Công chứng Đông Sài Gòn

1. Ghi nhận sự có mặt: Bà Phạm Thu Hà và ông Võ Thành Nam đều có mặt đúng giờ hẹn theo Hợp đồng đặt cọc ngày 10/03/2024.
2. Ý kiến của bà Phạm Thu Hà: Không đồng ý ký Hợp đồng chuyển nhượng với nguyên giá 4.500.000.000 đồng vì diện tích xây dựng thực tế bị mất 42 m² do vướng quy hoạch lộ giới theo Văn bản số 318/CNVPĐKĐĐ ngày 02/05/2024.
3. Ý kiến của ông Võ Thành Nam: Trên Giấy chứng nhận quyền sử dụng đất cấp năm 2019 không ghi chú quy hoạch năm 2022 nên bản thân ông Nam lúc ký đặt cọc ngày 10/03/2024 cũng không biết có quy hoạch 1/2000 năm 2022, đồng thời trước khi đặt cọc ông đã gửi ảnh chụp sổ đỏ cho bà Hà tự kiểm tra.`
    }
  ]
};

export const sampleCasesCatalog = [
  { _id: '6ab9e357841e796dc88815a8', ...sampleLandCase },
  { _id: '6abb6863841e796dc8881dc3', ...case1Appeal },
  caseAnPhucMai,
  caseLaborSaoKhue,
  caseDepositContractThuDuc,
];

export async function ensureSampleCasesSeeded() {
  const operations = sampleCasesCatalog.map((item, idx) => {
    const objectId = new mongoose.Types.ObjectId(item._id);
    const doc = {
      ...item,
      _id: objectId,
      created_at: new Date(Date.UTC(2026, 3, 18, 12, idx, 0)),
      __v: 0,
    };
    return {
      updateOne: {
        filter: { _id: objectId },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    };
  });
  await Case.collection.bulkWrite(operations, { ordered: false });
}
