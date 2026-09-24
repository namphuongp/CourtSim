import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { AiPersonal, Case, User } from '../models/index.js';

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@courtsim.local').trim().toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const defaultAiModel = process.env.GEMINI_API_KEY ? 'gemini-3.6-flash' : 'qwen2.5:7b';

const aiPersonals = [
  {
    role_name: 'judge',
    system_prompt: 'Bạn đóng vai Thẩm phán điều hành phiên tòa mô phỏng theo pháp luật Việt Nam. Giữ thái độ trung lập, điều phối đúng trình tự và không bịa đặt căn cứ pháp luật.',
    model_id: process.env.AI_JUDGE_MODEL ?? defaultAiModel,
    temperature: 0.3,
  },
  {
    role_name: 'prosecutor',
    system_prompt: 'Bạn đóng vai Kiểm sát viên trong phiên tòa mô phỏng. Lập luận dựa trên hồ sơ được cung cấp, nêu rõ chứng cứ và căn cứ pháp luật; không tự tạo tình tiết mới.',
    model_id: process.env.AI_OPPONENT_MODEL ?? defaultAiModel,
    temperature: 0.5,
  },
  {
    role_name: 'evaluator',
    system_prompt: 'Bạn là giám khảo phiên tòa mô phỏng. Chấm phần thể hiện của người dùng theo rubric, dẫn lại phát biểu liên quan và đưa ra góp ý cụ thể, có thể thực hành.',
    model_id: process.env.AI_EVALUATOR_MODEL ?? defaultAiModel,
    temperature: 0.2,
  },
];

const cases = [
  {
    title: 'Tranh chấp hợp đồng vay tài sản',
    category: 'dân sự',
    summary: 'Nguyên đơn yêu cầu bị đơn hoàn trả khoản vay đến hạn. Bị đơn cho rằng đã thanh toán một phần nhưng không có biên nhận đầy đủ.',
    full_document: [
      'Đây là hồ sơ giả định chỉ phục vụ mục đích học tập.',
      'Nguyên đơn cung cấp hợp đồng vay có chữ ký hai bên và sao kê chuyển khoản.',
      'Bị đơn thừa nhận giao dịch vay nhưng khai đã trả một phần bằng tiền mặt.',
      'Nhiệm vụ của người học: xác định nghĩa vụ chứng minh, đánh giá chứng cứ và trình bày yêu cầu bảo vệ thân chủ.',
    ].join('\n'),
  },
  {
    title: 'Tranh chấp đơn phương chấm dứt hợp đồng lao động',
    category: 'lao động',
    summary: 'Người lao động cho rằng doanh nghiệp chấm dứt hợp đồng trái pháp luật; doanh nghiệp viện dẫn lý do thường xuyên không hoàn thành công việc.',
    full_document: [
      'Đây là hồ sơ giả định chỉ phục vụ mục đích học tập.',
      'Hồ sơ gồm hợp đồng lao động, quyết định chấm dứt và các phiếu đánh giá công việc.',
      'Các bên tranh luận về tiêu chí đánh giá, trình tự thông báo và quyền lợi khi chấm dứt hợp đồng.',
      'Nhiệm vụ của người học: xây dựng luận điểm, đặt câu hỏi và phản biện chứng cứ của bên còn lại.',
    ].join('\n'),
  },
];

function validateSeedEnvironment() {
  if (!adminPassword || adminPassword.length < 5 || adminPassword.length > 128) {
    throw new Error('SEED_ADMIN_PASSWORD phải có từ 5 đến 128 ký tự.');
  }
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        username: 'CourtSim Admin',
        password_hash: passwordHash,
        system_role: 'admin',
        subscription_type: 'pro',
        status: 'active',
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seedAiPersonals() {
  await Promise.all(aiPersonals.map(({ role_name: roleName, ...data }) =>
    AiPersonal.findOneAndUpdate(
      { role_name: roleName },
      { $set: data },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )));
}

async function seedCases() {
  await Promise.all(cases.map(({ title, ...data }) =>
    Case.findOneAndUpdate(
      { title },
      { $set: data, $setOnInsert: { title } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )));
}

async function run() {
  validateSeedEnvironment();
  await connectDatabase();
  await seedAdmin();
  await seedAiPersonals();
  await seedCases();
  console.log(`Seed hoàn tất: 1 admin, ${aiPersonals.length} vai AI, ${cases.length} vụ án mẫu.`);
}

run()
  .catch((error) => {
    console.error('Seed thất bại:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
