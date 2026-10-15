// Điểm tối đa chép từ tài liệu; không coi bản đề xuất là rubric đã được chuyên gia duyệt.
export const SCORING_RUBRIC = {
  version: 'courtsim-mvp-1.0-proposal-013f659a',
  source: 'Tiêu chí chấm điểm cho AI.docx',
  source_sha256: '013f659a3b6aba483da5ffc755633c2cee02a4d3c2111f16609f2816d81482d4',
  status: 'proposal', total: 100,
  groups: [
    { id: 'issue_identification', label: 'Xác định vấn đề pháp lý và mục tiêu bảo vệ', max: 15, items: [
      ['1.1', 'Xác định vấn đề pháp lý', 7, 'Nhận diện vấn đề chính, liên quan; phân biệt trọng tâm và vấn đề phụ.'],
      ['1.2', 'Xác định mục tiêu của bên mình', 5, 'Nêu yêu cầu, quyền lợi cần bảo vệ và kết quả pháp lý hướng tới.'],
      ['1.3', 'Xác định trọng tâm tranh tụng', 3, 'Tập trung vấn đề ảnh hưởng kết quả, tránh thông tin không liên quan.'],
    ] },
    { id: 'legal_application', label: 'Xác định và áp dụng căn cứ pháp luật', max: 20, items: [
      ['2.1', 'Xác định đúng quy định pháp luật', 7, 'Chọn văn bản, điều/khoản/điểm liên quan vấn đề.'],
      ['2.2', 'Hiểu đúng quy định', 5, 'Hiểu nội dung và điều kiện áp dụng, không chỉ nêu số điều.'],
      ['2.3', 'Áp dụng quy định vào vụ án', 6, 'Giải thích vì sao quy định áp dụng cho tình huống cụ thể.'],
      ['2.4', 'Tính chính xác của căn cứ', 2, 'Kiểm tra viện dẫn, phiên bản hiệu lực theo thời điểm và cách hiểu.'],
    ] },
    { id: 'evidence_analysis', label: 'Phân tích tình tiết và chứng cứ', max: 20, items: [
      ['3.1', 'Nhận diện tình tiết quan trọng', 5, 'Xác định tình tiết có ý nghĩa pháp lý.'],
      ['3.2', 'Lựa chọn chứng cứ phù hợp', 5, 'Chọn đúng tài liệu, lời khai hoặc chứng cứ có trong hồ sơ.'],
      ['3.3', 'Liên kết chứng cứ với lập luận', 7, 'Giải thích chứng cứ chứng minh điều gì, hỗ trợ luận điểm nào.'],
      ['3.4', 'Tính trung thực với hồ sơ', 3, 'Không tạo chứng cứ, tình tiết, lời khai hoặc nội dung tài liệu.'],
    ] },
    { id: 'legal_reasoning', label: 'Xây dựng lập luận pháp lý', max: 20, items: [
      ['4.1', 'Tính logic', 5, 'Các luận điểm liên kết hợp lý.'],
      ['4.2', 'Liên kết pháp luật – tình tiết – kết luận', 7, 'Nối quy định với tình tiết, chứng cứ và kết luận.'],
      ['4.3', 'Tính thuyết phục của lập luận', 5, 'Đủ cơ sở bảo vệ quan điểm của bên mình; nêu giới hạn khi thiếu nguồn.'],
      ['4.4', 'Tính nhất quán', 3, 'Đối chiếu mâu thuẫn giữa các lập luận trong phiên.'],
    ] },
    { id: 'rebuttal', label: 'Phản biện và xử lý lập luận đối phương', max: 15, items: [
      ['5.1', 'Nhận diện lập luận của đối phương', 3, 'Hiểu chính xác điều đối phương đang lập luận.'],
      ['5.2', 'Phát hiện điểm yếu', 4, 'Phát hiện thiếu căn cứ, sai áp dụng, chứng cứ yếu, mâu thuẫn hoặc suy luận sai.'],
      ['5.3', 'Đưa ra phản biện', 5, 'Dùng pháp luật, tình tiết, chứng cứ để phản bác trong phạm vi đã xác minh.'],
      ['5.4', 'Bảo vệ lập luận khi bị phản bác', 3, 'Bảo vệ, bổ sung căn cứ hoặc điều chỉnh khi bị phản biện tiếp.'],
    ] },
    { id: 'adaptation', label: 'Ứng biến và điều chỉnh chiến lược', max: 10, items: [
      ['6.1', 'Nhận diện ảnh hưởng của tình tiết mới', 3, 'Nhận diện tác động của tình tiết hoặc lập luận mới đến vấn đề pháp lý.'],
      ['6.2', 'Điều chỉnh lập luận', 3, 'Bổ sung hoặc thay đổi lập luận phù hợp.'],
      ['6.3', 'Duy trì mục tiêu bảo vệ', 2, 'Tiếp tục bảo vệ quyền lợi hợp pháp khi có diễn biến mới.'],
      ['6.4', 'Khả năng xử lý tình huống', 2, 'Phản hồi phù hợp diễn biến vụ án.'],
    ] },
  ].map((group) => ({ ...group, items: group.items.map(([id, label, max, guidance]) => ({ id, label, max, guidance })) })),
};
