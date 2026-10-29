import { roleLabel } from './simulation.js';
import { dialogueText } from '../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles } from './courtroom.js';

/**
 * Định dạng ngày theo chuẩn văn bản hành chính Việt Nam (ngày DD tháng MM năm YYYY)
 */
export function formatVietnameseDate(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return 'ngày ... tháng ... năm ...';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * Xếp loại kết quả theo điểm số (thang 100)
 */
export function getGradeLabel(score) {
  const num = typeof score === 'number' ? score : Number(score) || 0;
  if (num >= 90) return { label: 'Xuất sắc', color: '#166534', bg: '#dcfce7' };
  if (num >= 80) return { label: 'Giỏi', color: '#15803d', bg: '#f0fdf4' };
  if (num >= 70) return { label: 'Khá', color: '#1d4ed8', bg: '#eff6ff' };
  if (num >= 50) return { label: 'Đạt', color: '#b45309', bg: '#fef3c7' };
  return { label: 'Cần rèn luyện thêm', color: '#b91c1c', bg: '#fee2e2' };
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const RUBRIC_LABELS = {
  legal_knowledge: 'Kiến thức pháp lý & Căn cứ áp dụng',
  reasoning: 'Kỹ năng lập luận & Tư duy pháp lý',
  evidence_use: 'Sử dụng chứng cứ & Bút lục hồ sơ',
  courtroom_skill: 'Kỹ năng tranh tụng & Văn hóa tố tụng',
};

/**
 * Tạo nội dung HTML hoàn chỉnh của văn bản pháp lý CourtSim phục vụ xuất PDF
 * @param {object} params
 * @param {'all'|'result'|'transcript'} params.type - Loại tài liệu xuất
 * @param {object} params.session - Dữ liệu phiên mô phỏng
 * @param {object} [params.result] - Kết quả đánh giá
 * @param {Array} [params.records] - Danh sách các lượt đối đáp trong phiên
 * @param {object} [params.currentUser] - Thông tin học viên hiện tại
 */
export function generateCourtroomDocumentHtml({
  type = 'all',
  session,
  result,
  records = [],
  currentUser = null,
}) {
  const courtCase = session?.case_id || session?.case_snapshot || {};
  const caseTitle = courtCase.title || 'Vụ án mô phỏng';
  const caseCategory = courtCase.category || 'Tố tụng';
  const userRole = roleLabel(session?.user_court_role, courtCase.category, courtCase);
  const learnerName = currentUser?.username || currentUser?.name || 'Học viên CourtSim';
  const roles = courtroomRoles(session);
  const dateFormatted = formatVietnameseDate(session?.completed_at || session?.updated_at || new Date());
  const sessionIdShort = String(session?._id || '').slice(-8).toUpperCase();

  const isResultIncluded = (type === 'result' || type === 'all') && Boolean(result);
  const isTranscriptIncluded = (type === 'transcript' || type === 'all') && Boolean(records?.length);

  const documentTitle = type === 'result'
    ? 'BẢN ĐÁNH GIÁ KẾT QUẢ TRANH TỤNG MÔ PHỎNG'
    : type === 'transcript'
      ? 'BIÊN BẢN PHIÊN TÒA TRANH TỤNG MÔ PHỎNG'
      : 'HỒ SƠ TỔNG HỢP VÀ KẾT QUẢ TRANH TỤNG MÔ PHỎNG';

  const grade = isResultIncluded ? getGradeLabel(result.score) : null;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle} - ${caseTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 20mm 18mm 20mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Times New Roman', Times, 'DejaVu Serif', serif;
      font-size: 13pt;
      line-height: 1.35;
      text-align: justify;
    }
    .document-page {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
    }
    /* Header Quốc hiệu & Đơn vị */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .header-left {
      width: 48%;
      text-align: center;
      font-size: 11.5pt;
    }
    .header-left .org-parent {
      text-transform: uppercase;
      font-weight: normal;
    }
    .header-left .org-name {
      text-transform: uppercase;
      font-weight: bold;
      font-size: 12pt;
    }
    .header-left .doc-code {
      margin-top: 4px;
      font-size: 11pt;
    }
    .header-left .divider {
      width: 80px;
      height: 1px;
      background: #000;
      margin: 4px auto 0;
    }
    .header-right {
      width: 50%;
      text-align: center;
    }
    .header-right .country {
      text-transform: uppercase;
      font-weight: bold;
      font-size: 11.5pt;
      letter-spacing: 0.5px;
    }
    .header-right .motto {
      font-weight: bold;
      font-size: 12.5pt;
      margin-top: 2px;
    }
    .header-right .divider {
      width: 140px;
      height: 1px;
      background: #000;
      margin: 4px auto 8px;
    }
    .header-right .doc-date {
      font-style: italic;
      font-size: 11.5pt;
      margin-top: 6px;
    }
    /* Tiêu đề văn bản */
    .doc-title-block {
      text-align: center;
      margin: 28px 0 20px;
    }
    .doc-title {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 0 6px 0;
      letter-spacing: 0.5px;
    }
    .doc-subtitle {
      font-size: 13pt;
      font-weight: bold;
      font-style: italic;
      margin: 0;
    }
    /* Các phần của văn bản */
    .section-title {
      font-size: 13.5pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 20px 0 10px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 3px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5pt;
    }
    .info-table td {
      padding: 4px 6px;
      vertical-align: top;
    }
    .info-table td.label {
      width: 28%;
      font-weight: bold;
      white-space: nowrap;
    }
    .info-table td.colon {
      width: 2%;
      padding-right: 4px;
    }
    .info-table td.value {
      width: 70%;
    }
    /* Bảng điểm & Rubric */
    .score-summary-box {
      border: 1.5px solid #000;
      padding: 12px 16px;
      margin: 16px 0;
      background-color: #fafafa;
    }
    .score-summary-box .score-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14pt;
      font-weight: bold;
    }
    .score-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12pt;
    }
    .score-table th, .score-table td {
      border: 1px solid #000;
      padding: 6px 8px;
    }
    .score-table th {
      background-color: #f0f0f0;
      text-align: center;
      font-weight: bold;
    }
    .score-table td.center {
      text-align: center;
    }
    .rubric-item {
      margin-bottom: 14px;
      padding-left: 8px;
      border-left: 3px solid #333;
    }
    .rubric-item h4 {
      margin: 0 0 4px 0;
      font-size: 12.5pt;
      font-weight: bold;
    }
    .rubric-item blockquote {
      margin: 4px 0 6px;
      padding: 4px 10px;
      background: #f7f7f7;
      font-style: italic;
      border-left: 2px solid #888;
      font-size: 12pt;
    }
    /* Diễn biến tranh tụng */
    .transcript-entry {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .transcript-entry .speaker-tag {
      font-weight: bold;
      font-size: 12.5pt;
      margin-bottom: 2px;
      color: #000;
    }
    .transcript-entry .speaker-user {
      color: #1e3a8a;
    }
    .transcript-entry .speaker-judge {
      color: #78350f;
    }
    .transcript-entry .speaker-opponent {
      color: #991b1b;
    }
    .transcript-entry .dialogue-body {
      margin: 0;
      line-height: 1.35;
      text-align: justify;
      white-space: pre-wrap;
    }
    .transcript-entry .dialogue-citations {
      margin-top: 4px;
      font-size: 11pt;
      font-style: italic;
      color: #444;
    }
    /* Phần ký tên */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-col {
      width: 32%;
      text-align: center;
      font-size: 12pt;
    }
    .sig-col .sig-title {
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .sig-col .sig-sub {
      font-style: italic;
      font-size: 11pt;
    }
    .sig-col .sig-space {
      height: 70px;
    }
    .sig-col .sig-name {
      font-weight: bold;
      font-size: 12pt;
    }
    .doc-footer-note {
      margin-top: 35px;
      padding-top: 8px;
      border-top: 1px dashed #777;
      font-size: 10pt;
      font-style: italic;
      text-align: center;
      color: #555;
    }
    .page-break {
      page-break-before: always;
    }
    @media screen {
      body {
        background: #f1f5f9;
        padding: 24px 12px;
      }
      .document-page {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
        padding: 40px 48px;
        border-radius: 4px;
      }
    }
    @media print {
      body {
        background: transparent;
      }
      .document-page {
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="document-page">
    <!-- Header Quốc hiệu -->
    <div class="doc-header">
      <div class="header-left">
        <div class="org-parent">HỌC VIỆN TƯ PHÁP / COURTSIM</div>
        <div class="org-name">TÒA ÁN MÔ PHỎNG ĐIỆN TỬ</div>
        <div class="divider"></div>
        <div class="doc-code">Số: ${sessionIdShort}/BB-COURTSIM</div>
      </div>
      <div class="header-right">
        <div class="country">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
        <div class="divider"></div>
        <div class="doc-date">Hà Nội, ${dateFormatted}</div>
      </div>
    </div>

    <!-- Tiêu đề văn bản -->
    <div class="doc-title-block">
      <h1 class="doc-title">${documentTitle}</h1>
      <p class="doc-subtitle">Vụ án: ${escapeHtml(caseTitle)}</p>
    </div>

    <!-- PHẦN I: THÔNG TIN PHIÊN TÒA -->
    <div class="section-title">I. THÔNG TIN CHUNG VỀ PHIÊN TRANH TỤNG</div>
    <table class="info-table">
      <tr>
        <td class="label">Tên vụ án</td>
        <td class="colon">:</td>
        <td class="value"><strong>${escapeHtml(caseTitle)}</strong></td>
      </tr>
      <tr>
        <td class="label">Lĩnh vực pháp luật</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(caseCategory)}</td>
      </tr>
      <tr>
        <td class="label">Học viên tham gia</td>
        <td class="colon">:</td>
        <td class="value"><strong>${escapeHtml(learnerName)}</strong></td>
      </tr>
      <tr>
        <td class="label">Tư cách tố tụng</td>
        <td class="colon">:</td>
        <td class="value"><strong>${escapeHtml(userRole)}</strong></td>
      </tr>
      <tr>
        <td class="label">Chủ tọa phiên tòa</td>
        <td class="colon">:</td>
        <td class="value">${roles?.judge?.name || 'Thẩm phán Chủ tọa'} (${roles?.judge?.detail || 'Hội đồng xét xử'})</td>
      </tr>
      <tr>
        <td class="label">Bên đối lập</td>
        <td class="colon">:</td>
        <td class="value">${roles?.opponent?.name || 'Bên đối lập'} (${roles?.opponent?.detail || 'Đại diện'})</td>
      </tr>
      <tr>
        <td class="label">Mốc sự kiện hồ sơ</td>
        <td class="colon">:</td>
        <td class="value">${session?.case_event_date || 'Theo hồ sơ vụ án'}</td>
      </tr>
      <tr>
        <td class="label">Số lượt tranh luận</td>
        <td class="colon">:</td>
        <td class="value">${records?.filter(r => r.sender_type === 'user')?.length || session?.turn_count || 0} lượt hoàn thành</td>
      </tr>
    </table>

    ${isResultIncluded ? `
    <!-- PHẦN II: KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC -->
    <div class="section-title">II. KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC TRANH TỤNG</div>
    
    <div class="score-summary-box">
      <div class="score-row">
        <span>TỔNG ĐIỂM ĐÁNH GIÁ: ${result.score}/100 ĐIỂM</span>
        <span style="color: ${grade.color};">XẾP LOẠI: ${grade.label.toUpperCase()}</span>
      </div>
    </div>

    ${result.rubric_scores ? `
    <table class="score-table">
      <thead>
        <tr>
          <th style="width: 10%;">STT</th>
          <th style="width: 50%;">Tiêu chí đánh giá năng lực</th>
          <th style="width: 20%;">Điểm đạt</th>
          <th style="width: 20%;">Thang điểm</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(RUBRIC_LABELS).map(([key, label], idx) => {
          const score = result.rubric_scores[key] ?? '—';
          return `
          <tr>
            <td class="center">${idx + 1}</td>
            <td><strong>${label}</strong></td>
            <td class="center"><strong>${score}</strong></td>
            <td class="center">25.0</td>
          </tr>
          `;
        }).join('')}
        <tr style="font-weight: bold; background: #fafafa;">
          <td colspan="2" style="text-align: right; padding-right: 14px;">TỔNG ĐIỂM XẾP HẠNG:</td>
          <td class="center" style="font-size: 13pt; color: #1e3a8a;">${result.score}</td>
          <td class="center">100.0</td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    ${result.rubric_feedback ? `
    <div style="margin-top: 16px;">
      <strong style="font-size: 13pt;">1. Nhận xét chi tiết theo tiêu chí Rubric:</strong>
      <div style="margin-top: 8px;">
        ${Object.entries(result.rubric_feedback).map(([key, item]) => `
          <div class="rubric-item">
            <h4>${RUBRIC_LABELS[key] || key}:</h4>
            <p style="margin: 2px 0;"><strong>Nhận định:</strong> ${item.reason || 'Đã thể hiện trong phiên tranh luận.'}</p>
            ${item.quote ? `<blockquote>“${item.quote}”</blockquote>` : ''}
            ${item.strength ? `<p style="margin: 2px 0;"><strong>Điểm mạnh:</strong> ${item.strength}</p>` : ''}
            ${item.improvement ? `<p style="margin: 2px 0;"><strong>Khuyến nghị hoàn thiện:</strong> ${item.improvement}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${result.feedback ? `
    <div style="margin-top: 14px;">
      <strong style="font-size: 13pt;">2. Nhận xét tổng quan của Hội đồng Giám khảo:</strong>
      <p style="margin: 4px 0 10px; line-height: 1.4;">${result.feedback}</p>
    </div>
    ` : ''}

    ${result.improvement_suggestions ? `
    <div style="margin-top: 10px;">
      <strong style="font-size: 13pt;">3. Định hướng rèn luyện & kỹ năng bổ trợ:</strong>
      <p style="margin: 4px 0 10px; line-height: 1.4;">${result.improvement_suggestions}</p>
    </div>
    ` : ''}

    ${result.citations?.length ? `
    <div style="margin-top: 10px;">
      <strong style="font-size: 13pt;">4. Danh mục căn cứ pháp luật đã được xác minh:</strong>
      <ul style="margin: 4px 0; padding-left: 24px;">
        ${result.citations.map(c => `
          <li>
            <strong>${c.title || c.law_number || 'Văn bản quy phạm pháp luật'}</strong>:
            Điều ${c.article || ''} ${c.text ? `- ${c.text.slice(0, 160)}…` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    ` : ''}

    ${isTranscriptIncluded ? `
    <!-- PHẦN III: DIỄN BIẾN TRANH TỤNG -->
    <div class="${isResultIncluded ? 'page-break' : ''}"></div>
    <div class="section-title">
      ${isResultIncluded ? 'III. BIÊN BẢN DIỄN BIẾN TRANH TỤNG TẠI PHIÊN TÒA' : 'II. DIỄN BIẾN TRANH TỤNG TẠI PHIÊN TÒA'}
    </div>
    <p style="font-style: italic; font-size: 11.5pt; margin-top: 0;">
      (Ghi nhận đầy đủ theo trình tự thời gian các phát biểu, chất vấn và đối đáp tại phiên tòa mô phỏng)
    </p>

    <div class="transcript-container" style="margin-top: 16px;">
      ${records.map((record, idx) => {
        const actor = actorFor(record);
        const speakerRoleName = roles[actor]?.name || record.sender_name || 'Người tham gia';
        const isUser = record.sender_type === 'user';
        const speakerClass = isUser ? 'speaker-user' : actor === 'judge' ? 'speaker-judge' : 'speaker-opponent';
        const content = dialogueText(record.display_content || record.content, courtCase.evidence_inventory);
        const turnNumber = String(idx + 1).padStart(2, '0');

        return `
        <div class="transcript-entry">
          <div class="speaker-tag ${speakerClass}">
            [LƯỢT ${turnNumber}] · ${speakerRoleName.toUpperCase()}
          </div>
          <p class="dialogue-body">${escapeHtml(content)}</p>
          ${record.citations?.length ? `
          <div class="dialogue-citations">
            Căn cứ pháp luật: ${record.citations.map(c => `${c.title || c.law_number} (Điều ${c.article || ''})`).join('; ')}
          </div>
          ` : ''}
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}

    <!-- PHẦN XÁC NHẬN CHỮ KÝ -->
    <div class="signature-grid">
      <div class="sig-col">
        <div class="sig-title">NGƯỜI THỰC HIỆN</div>
        <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${learnerName}</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">THƯ KÝ PHIÊN TÒA</div>
        <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">Thư ký Tòa mô phỏng</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">CHỦ TỌA PHIÊN TÒA</div>
        <div class="sig-sub">(Ký và đóng dấu điện tử)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${roles?.judge?.name || 'Thẩm phán Chủ tọa'}</div>
      </div>
    </div>

    <div class="doc-footer-note">
      Văn bản điện tử được trích xuất tự động từ Hệ thống mô phỏng tranh tụng CourtSim (Mã phiên: ${sessionIdShort}).
      Chỉ phục vụ mục đích đào tạo, học tập và rèn luyện kỹ năng pháp lý.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Mở cửa sổ in / xuất PDF chuẩn A4 chất lượng cao
 * Sử dụng iframe chuyên dụng để không làm ảnh hưởng giao diện ứng dụng
 */
export function exportDocumentToPdf(htmlContent, documentTitle = 'Tai_Lieu_Phien_Toa') {
  return new Promise((resolve) => {
    // Tạo iframe ẩn để in tài liệu sạch
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('title', documentTitle);

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Chờ tài liệu render xong hoàn toàn
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        resolve(true);
      } catch (err) {
        console.warn('Lỗi khi mở cửa sổ in PDF:', err);
        // Fallback: Mở cửa sổ mới nếu iframe bị chặn
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 300);
        }
        resolve(false);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 3000);
      }
    }, 400);
  });
}

/**
 * Tải tài liệu dưới dạng tệp HTML độc lập có thể xem offline hoặc in lại bất cứ lúc nào
 */
export function downloadDocumentAsHtml(htmlContent, filename = 'Bien_ban_phien_toa.html') {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
