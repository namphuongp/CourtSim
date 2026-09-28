// Lược biên cho học tập; không lưu phán quyết để tránh dùng làm đáp án chấm điểm.
export const sampleLandCase = {
  title: 'Tranh chấp quyền sử dụng đất — bài tập từ bản án 51/2024/DS-ST',
  category: 'đất đai',
  parties: [
    { side: 'plaintiff', name: 'A (đã ẩn danh)', claims: ['Yêu cầu trả 229,7 m² đất; viện dẫn giấy chứng nhận cấp cho hộ gia đình năm 1996.'] },
    { side: 'defendant', name: 'B (đã ẩn danh)', claims: ['Cho rằng đất có nguồn gốc từ gia đình mình và đã sử dụng lâu dài.'] },
  ],
  summary: 'Hai bên tranh chấp 229,7 m² đất mương và bờ mương. Luyện đối chiếu giấy chứng nhận với lời khai về quá trình sử dụng.',
  full_document: [
    'Hồ sơ lược biên, ẩn danh A (nguyên đơn), B (bị đơn); không thay thế hồ sơ tố tụng gốc.',
    'A yêu cầu trả 229,7 m²; viện dẫn giấy chứng nhận cấp cho hộ gia đình năm 1996. B cho rằng đất có nguồn gốc từ gia đình mình và đã sử dụng lâu dài.',
    'Tài liệu được bản án thuật lại: giấy chứng nhận, thông tin cơ quan đăng ký đất đai, lời khai nhân chứng và quá trình hòa giải. Một số nhân chứng có quan hệ với các bên; lời khai về nguồn gốc, sử dụng không thống nhất.',
    'Một phần mương 217 m² khác không thuộc yêu cầu đang xét. Bài tập không cung cấp bản gốc chứng cứ, sơ đồ đo đạc hay toàn bộ lời khai; không được tự bổ sung nội dung còn thiếu.',
  ].join('\n\n'),
  source_url: 'https://thuvienphapluat.vn/banan/ban-an/ban-an-ve-tranh-chap-quyen-su-dung-dat-so-512024dsst-331384',
  source_note: 'Nguồn đăng lại: Thư Viện Pháp Luật; bản án sơ thẩm 51/2024/DS-ST, TAND thị xã Vĩnh Châu, Sóc Trăng. Chưa xác minh tình trạng kháng cáo hoặc hiệu lực; không giới thiệu là án lệ.',
  reference_date: '2024-03-29',
  reference_date_note: 'Mốc tra cứu cố định theo ngày xét xử, không phải ngày phát sinh tranh chấp. Việc áp dụng luật còn phụ thuộc thời điểm từng sự kiện và quy định chuyển tiếp.',
  legal_scope_note: 'Bài tập ưu tiên lập luận và đánh giá chứng cứ. Bản gốc Luật Đất đai 2013 đã được bổ sung; lịch sử sửa đổi và căn cứ cho từng mốc cần được xác minh trước khi chấm pháp luật. Không thay bằng Luật Đất đai 2024 hoặc chấm theo kết quả bản án gốc.',
  timeline: [
    { kind: 'transaction', date: '1996-01-01', date_to: '1996-12-31', status: 'reported', description: 'Giấy chứng nhận được đề cập năm 1996; hồ sơ lược biên chưa chốt ngày.', source_quote: 'giấy chứng nhận cấp cho hộ gia đình năm 1996' },
    { kind: 'filing', date: '2022-07-18', date_to: '2022-07-18', status: 'reported', description: 'Ngày đơn khởi kiện được bản án đề cập.', source_quote: 'Theo đơn khởi kiện ngày 18 tháng 7 năm 2022' },
    { kind: 'hearing', date: '2024-03-29', date_to: '2024-03-29', status: 'reported', description: 'Ngày xét xử sơ thẩm được bản án đề cập.', source_quote: 'BẢN ÁN 51/2024/DS-ST NGÀY 29/03/2024' },
  ],
  evidence_inventory: [
    { name: 'Giấy chứng nhận', summary: 'Bản án đề cập giấy chứng nhận cấp cho hộ gia đình năm 1996; A viện dẫn để yêu cầu trả đất.' },
    { name: 'Thông tin cơ quan đăng ký đất đai', summary: 'Bản án đề cập thông tin cơ quan đăng ký đất đai; bài tập chưa cung cấp nội dung tài liệu.' },
    { name: 'Lời khai nhân chứng', summary: 'Lời khai về nguồn gốc, sử dụng đất không thống nhất; một số nhân chứng có quan hệ với các bên.' },
    { name: 'Hòa giải', summary: 'Bản án đề cập quá trình hòa giải; bài tập chưa cung cấp biên bản.' },
  ].map((item) => ({ ...item, availability: 'mentioned_only', source_quote: 'Tài liệu được bản án thuật lại; không có bản gốc trong bài tập.' })),
};
