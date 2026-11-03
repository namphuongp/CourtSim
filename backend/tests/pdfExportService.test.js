import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDurationForDoc,
  formatVietnameseDate,
  getGradeLabel,
  escapeHtml,
  generateCourtroomDocumentHtml
} from '../../frontend/src/services/pdfExportService.js';

test('pdfExportService: formatDurationForDoc hiển thị thời lượng chuẩn xác', () => {
  assert.equal(formatDurationForDoc(0), '—');
  assert.equal(formatDurationForDoc(null), '—');
  assert.equal(formatDurationForDoc(45), '45 giây');
  assert.equal(formatDurationForDoc(120), '2 phút');
  assert.equal(formatDurationForDoc(125), '2 phút 5 giây');
  assert.equal(formatDurationForDoc(1835), '30 phút 35 giây');
});

test('pdfExportService: formatVietnameseDate theo thể thức văn bản hành chính', () => {
  const formatted = formatVietnameseDate(new Date('2026-11-03T10:00:00Z'));
  assert.match(formatted, /ngày \d{2} tháng 11 năm 2026/);
});

test('pdfExportService: getGradeLabel phân loại chuẩn thang 100', () => {
  assert.equal(getGradeLabel(95).label, 'Xuất sắc');
  assert.equal(getGradeLabel(85).label, 'Giỏi');
  assert.equal(getGradeLabel(75).label, 'Khá');
  assert.equal(getGradeLabel(55).label, 'Đạt');
  assert.equal(getGradeLabel(40).label, 'Cần rèn luyện thêm');
});

test('pdfExportService: generateCourtroomDocumentHtml kết xuất thời lượng và cảnh báo hiệu lực pháp luật', () => {
  const session = {
    _id: '67c54123456789abcdef1234',
    user_court_role: 'defense_lawyer',
    case_event_date: '2012-05-15',
    duration_seconds: 730,
    case_id: {
      title: 'Tranh chấp ranh giới quyền sử dụng đất tại xã Bình Minh',
      category: 'Dân sự - Đất đai',
      evidence_inventory: []
    }
  };

  const result = {
    score: 88,
    duration_seconds: 730,
    rubric_scores: {
      legal_knowledge: 22,
      reasoning: 23,
      evidence_use: 21,
      courtroom_skill: 22
    },
    citations: [
      {
        id: 'CIT-01',
        title: 'Luật Đất đai 2003',
        law_number: '13/2003/QH11',
        article: '106',
        text: 'Người sử dụng đất được thực hiện các quyền chuyển đổi, chuyển nhượng...',
        validity_status: 'expired',
        validity_warning: 'Lưu ý: Áp dụng tại thời điểm xảy ra vụ việc năm 2012; hiện nay đã hết hiệu lực và được thay thế bởi Luật Đất đai 2013 và Luật Đất đai 2024.',
        change_history: [
          {
            type: 'original',
            title: 'Luật Đất đai 2003',
            law_number: '13/2003/QH11',
            effective_from: '2004-07-01',
            note: 'Văn bản gốc áp dụng tại thời điểm phát sinh quan hệ pháp luật'
          },
          {
            type: 'replacement',
            title: 'Luật Đất đai 2013',
            law_number: '45/2013/QH13',
            effective_from: '2014-07-01',
            note: 'Thay thế Luật Đất đai 2003'
          },
          {
            type: 'replacement',
            title: 'Luật Đất đai 2024',
            law_number: '31/2024/QH15',
            effective_from: '2024-08-01',
            note: 'Văn bản hiện hành'
          }
        ]
      }
    ]
  };

  const records = [
    {
      _id: 'rec-01',
      sender_type: 'user',
      content: 'Kính thưa HĐXX, căn cứ Điều 106 Luật Đất đai 2003, thân chủ tôi có toàn quyền sử dụng.',
      display_content: 'Kính thưa HĐXX, căn cứ Điều 106 Luật Đất đai 2003, thân chủ tôi có toàn quyền sử dụng.',
      citations: [
        {
          title: 'Luật Đất đai 2003',
          law_number: '13/2003/QH11',
          article: '106',
          validity_status: 'expired',
          validity_warning: 'Áp dụng tại mốc 2012, hiện đã hết hiệu lực'
        }
      ]
    },
    {
      _id: 'rec-02',
      sender_type: 'ai_judge',
      content: 'Chủ tọa ghi nhận căn cứ và chuyển sang phần xét hỏi.',
      citations: ['Điều 91 Bộ luật Tố tụng dân sự'] // String citation: không được crash hay ra undefined
    }
  ];

  const html = generateCourtroomDocumentHtml({
    type: 'all',
    session,
    result,
    records,
    currentUser: { name: 'Luật sư Nguyễn Văn A' }
  });

  // 1. Kiểm tra thời lượng phiên
  assert.ok(html.includes('Thời lượng tranh tụng'), 'Chứa mục thời lượng tranh tụng');
  assert.ok(html.includes('12 phút 10 giây'), 'Chứa số phút giây định dạng chuẩn');

  // 2. Kiểm tra cảnh báo hiệu lực văn bản pháp luật
  assert.ok(html.includes('HẾT HIỆU LỰC HIỆN HÀNH'), 'Chứa nhãn Hết hiệu lực hiện hành');
  assert.ok(html.includes('Áp dụng tại thời điểm xảy ra vụ việc năm 2012'), 'Chứa nội dung cảnh báo hiệu lực');

  // 3. Kiểm tra lịch sử thay đổi văn bản qua các thời kỳ
  assert.ok(html.includes('Lịch sử thay đổi văn bản qua các thời kỳ'), 'Chứa mục lịch sử thay đổi văn bản');
  assert.ok(html.includes('Luật Đất đai 2013'), 'Chứa mốc thay thế 2013');
  assert.ok(html.includes('Luật Đất đai 2024'), 'Chứa mốc hiện hành 2024');
  assert.ok(html.includes('2004-07-01'), 'Chứa ngày hiệu lực 2004-07-01');

  // 4. Kiểm tra trích dẫn trong diễn biến và an toàn với string citation
  assert.ok(html.includes('Điều 91 Bộ luật Tố tụng dân sự'), 'Hiển thị chuẩn string citation');
  assert.ok(!html.includes('undefined (Điều undefined)'), 'Không bị lỗi undefined');
});

