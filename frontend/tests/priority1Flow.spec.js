import { test, expect } from '@playwright/test';
import { sampleCasesCatalog, caseAnPhucMai } from '../../backend/src/data/sampleCasesCatalog.js';
import { evidenceInventory } from '../../backend/src/services/caseEvidence.js';
import { openingStatement } from '../../backend/src/services/casePractice.js';

const membership = {
  id: 'pro',
  name: 'Pro',
  freeLimit: 10,
  freeRemaining: 10,
  caseCredits: 20,
  canCreateSession: true,
  legalAssistant: true,
  detailedScoring: true,
  skillAnalytics: true,
};

const anPhucClientCase = {
  ...caseAnPhucMai,
  evidence_inventory: evidenceInventory(caseAnPhucMai),
};

test('Ưu tiên 1: 5 bản án mẫu, bút lục trực quan Nguyễn Ngọc Mai (02-BV/2026), đồng bộ Note cá nhân, đọc to đa câu và kết thúc phiên tòa tự nhiên bằng chat', async ({ page }) => {
  const sessionId = '507f1f77bcf86cd799439088';
  const opening = openingStatement(anPhucClientCase, 'plaintiff_lawyer');
  const ttsPayloads = [];
  const fakeMp3Bytes = Buffer.from('SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADBz4A', 'base64');

  let session = {
    _id: sessionId,
    case_id: anPhucClientCase,
    user_court_role: 'plaintiff_lawyer',
    ai_opponent_role: 'defense_lawyer',
    case_event_date: '2026-09-15',
    status: 'ongoing',
    turn_count: 0,
    max_turns: 20,
    features: { legalAssistant: true },
    conversation: {
      status: 'awaiting_continue',
      phase: 'opening',
      current_record_id: 'rec-open-1',
      next_speaker: 'learner',
      last_purpose: 'open',
      ready_to_close: false,
      auto_complete: false,
      revision: 1,
    },
  };

  let records = [
    {
      _id: 'rec-open-1',
      sender_type: 'ai_judge',
      purpose: 'open',
      next_speaker: 'learner',
      content: opening,
      timestamp: '2026-10-31T02:00:00.000Z',
    },
  ];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { user: { id: 'lawyer-1', full_name: 'Luật sư Thực hành', role: 'user' } } });
    }
    if (path.endsWith('/auth/membership')) {
      return route.fulfill({ json: { data: membership } });
    }
    if (path.endsWith('/cases')) {
      return route.fulfill({
        json: {
          data: sampleCasesCatalog.map((c) => ({ ...c, evidence_inventory: evidenceInventory(c) })),
          pagination: { total: sampleCasesCatalog.length },
        },
      });
    }
    if (path.endsWith(`/cases/${anPhucClientCase._id}`)) {
      return route.fulfill({ json: { data: anPhucClientCase } });
    }
    if (path.endsWith('/sessions') && method === 'POST') {
      return route.fulfill({ status: 201, json: { data: { session } } });
    }
    if (path.endsWith(`/sessions/${sessionId}`) && method === 'GET') {
      return route.fulfill({ json: { data: session } });
    }
    if (path.endsWith(`/sessions/${sessionId}/records`) && method === 'GET') {
      return route.fulfill({ json: { data: records } });
    }
    if (path.endsWith(`/sessions/${sessionId}/dialogue/seen`) && method === 'POST') {
      return route.fulfill({ json: { data: session.conversation } });
    }
    if (path.endsWith('/voice/tts') && method === 'POST') {
      const body = request.postDataJSON();
      ttsPayloads.push(body.text);
      return route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: fakeMp3Bytes,
      });
    }
    if (path.endsWith(`/sessions/${sessionId}/dialogue`) && method === 'POST') {
      const body = request.postDataJSON();
      if (body.action === 'advance') {
        session = {
          ...session,
          conversation: {
            ...session.conversation,
            status: 'learner',
            phase: 'presentation',
            revision: session.conversation.revision + 1,
          },
        };
        return route.fulfill({ json: { data: { session, records } } });
      }
      if (body.action === 'submit') {
        records = [
          ...records,
          {
            _id: 'rec-user-1',
            sender_type: 'user',
            content: body.content,
            request_id: body.request_id,
            timestamp: '2026-10-31T02:02:00.000Z',
          },
          {
            _id: 'rec-judge-close',
            sender_type: 'ai_judge',
            purpose: 'close',
            next_speaker: 'learner',
            content:
              'Hội đồng xét xử ghi nhận quan điểm tổng kết và Bản tường trình số 02-BV/2026 của phía nguyên đơn Nguyễn Ngọc Mai. Các tình tiết trọng tâm đã được làm rõ, Chủ tọa tuyên bố kết thúc phần tranh tụng để Hội đồng xét xử vào Nghị án.',
            timestamp: '2026-10-31T02:02:05.000Z',
          },
        ];
        session = {
          ...session,
          turn_count: 1,
          conversation: {
            status: 'awaiting_continue',
            phase: 'summary',
            current_record_id: 'rec-judge-close',
            next_speaker: 'learner',
            last_purpose: 'close',
            ready_to_close: true,
            auto_complete: true,
            revision: session.conversation.revision + 1,
          },
        };
        return route.fulfill({ json: { data: { session, records } } });
      }
    }
    if (path.endsWith(`/sessions/${sessionId}/complete`) && method === 'POST') {
      session = {
        ...session,
        status: 'completed',
        evaluation: {
          overall_score: 88,
          summary: 'Luật sư nắm vững hồ sơ chứng cứ 02-BV/2026 và lập luận chặt chẽ.',
          criteria: [],
        },
      };
      return route.fulfill({ json: { data: session } });
    }
    return route.fulfill({ json: { data: anPhucClientCase } });
  });

  // 1. Kiểm tra danh mục 5 bản án mẫu ở trang Thiết lập phiên tòa
  await page.goto('/dashboard/setup');
  await expect(page.locator('.setup-option')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /Vụ án Nguyễn Ngọc Mai/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Công ty Sao Khuê/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Phạm Thu Hà và ông Võ Thành Nam/i })).toBeVisible();

  await page.getByRole('button', { name: /Vụ án Nguyễn Ngọc Mai/i }).click();
  await page.getByRole('button', { name: 'Tiếp: Hồ sơ', exact: true }).click();

  // 2. Kiểm tra Tóm tắt diễn biến tiền tố tụng & Bút lục trực quan 02-BV/2026 + Bảng Note cá nhân
  await expect(page.getByRole('heading', { name: 'Tóm tắt diễn biến' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tóm tắt diễn biến' })).toContainText('Nguyễn Ngọc Mai');

  await page.getByRole('button', { name: /Tài liệu gốc \(4\)/i }).click();

  const visualSheet = page.getByLabel(/Bản chụp hồ sơ: Bản tường trình của Nguyễn Ngọc Mai/i);
  await expect(visualSheet).toBeVisible();
  await expect(visualSheet).toContainText('02-BV/2026');
  await expect(visualSheet).toContainText('15/09/2026');
  await expect(visualSheet).toContainText('Cơ sở lưu trú An Phúc');
  await expect(visualSheet).toContainText('Trương Văn Báu');
  await expect(visualSheet).toContainText('CƠ QUAN ĐIỀU TRA');
  await expect(visualSheet).toContainText('HS-XX-26');

  // Bấm "＋ Ghi vào Note cá nhân" và kiểm tra Bảng ghi chú cá nhân cập nhật ngay
  const maiCard = page.locator('#evidence-EV-anphuc-tuongtrinh');
  await maiCard.getByRole('button', { name: /Ghi vào Note cá nhân/i }).click();
  const notePanel = page.getByLabel('Bảng ghi chú cá nhân khi đọc hồ sơ');
  await expect(notePanel.locator('textarea')).toHaveValue(/Bản tường trình của Nguyễn Ngọc Mai/);

  // Đi qua các bước thiết lập và vào phòng xử án
  await page.getByRole('button', { name: 'Tiếp: Vai', exact: true }).click();
  await page.locator('.setup-role').first().click();
  await page.getByRole('button', { name: 'Tiếp: Mốc tra cứu', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp: Chuẩn bị', exact: true }).click();
  await page.locator('.setup-aside').getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect(page).toHaveURL(`/simulation/${sessionId}`);

  // 3. Kiểm tra thanh giai đoạn phiên tòa & đồng bộ Sổ tay từ bước đọc hồ sơ
  await expect(page.locator('.court-stage-toolbar')).toContainText('Giai đoạn I: Khai mạc & Thủ tục bắt đầu phiên tòa');
  await page.getByRole('button', { name: 'Sổ tay' }).click();
  await expect(page.locator('#session-notes')).toHaveValue(/Bản tường trình của Nguyễn Ngọc Mai/);
  await page.getByRole('button', { name: 'Đóng' }).click();

  // 4. Kiểm tra nút "Nghe đọc" gửi yêu cầu TTS cho các câu trong lời khai mạc của Chủ tọa
  await page.getByRole('button', { name: /Nghe đọc/i }).click();
  await expect.poll(() => ttsPayloads.length).toBeGreaterThanOrEqual(1);

  // Kiểm tra không tràn chiều ngang trên cả Desktop và Mobile
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // 5. Gõ trực tiếp vào ô chat đề nghị kết thúc / nghị án (không cần bấm nút Kết thúc thủ công) -> Tự động chấm điểm và chuyển sang trang Kết quả
  await page.getByLabel('Lập luận của bạn').fill(
    'Thưa Hội đồng xét xử, căn cứ [CC:EV-anphuc-tuongtrinh] Bản tường trình ngày 15/09/2026 của chị Nguyễn Ngọc Mai, phía nguyên đơn đề nghị HĐXX chuyển sang phần nghị án và xin kết thúc phiên tòa.'
  );
  await page.getByRole('button', { name: /Gửi lập luận/i }).click();

  await expect(page).toHaveURL(`/simulation/${sessionId}/result`);
});
