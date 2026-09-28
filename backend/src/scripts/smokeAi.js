import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { generateDebateTurn, evaluateSession } from '../services/simulationService.js';

// Chỉ dùng tình huống giả định cố định; không đọc Case, User, phiên hay biên bản người dùng.
const courtCase = {
  title: 'Bài kiểm thử giả định: hợp đồng vay tài sản', category: 'dân sự',
  summary: 'Hai bên tranh luận về việc một khoản vay đã được thanh toán hay chưa.',
  full_document: 'Hồ sơ kiểm thử hư cấu: có hợp đồng vay và sao kê chuyển tiền cho vay. Bên vay khai đã hoàn trả bằng tiền mặt nhưng chưa xuất trình biên nhận. Không có tên người, địa chỉ, số tiền hoặc hồ sơ thật.',
};
const session = {case_event_date:'2025-01-01',user_court_role:'defense_lawyer',difficulty:'beginner'};
const user = {_id:randomUUID(),sender_type:'user',sender_name:'Người học giả định',content:'Tôi bảo vệ bên vay. Hợp đồng và sao kê thể hiện việc cho vay, nhưng chưa chứng minh đã trả tiền. Tôi đề nghị đối chiếu biên nhận và lời khai, không khẳng định khoản vay đã được hoàn trả khi chưa có chứng cứ.'};

if (new URL(env.AI_BASE_URL).hostname !== 'generativelanguage.googleapis.com') {
  throw new Error('Bài kiểm thử này chỉ được cấu hình cho endpoint Gemini chính thức.');
}
try {
  await mongoose.connect(env.MONGO_URI,{serverSelectionTimeoutMS:5000});
  // Chỉ đọc persona và văn bản luật công khai do người dùng cung cấp, không ghi dữ liệu học tập.
  const turns = await generateDebateTurn({session,courtCase,records:[user]});
  console.log(JSON.stringify({debate:'passed',roles:turns.map(t=>t.sender_name),citationCount:turns.reduce((n,t)=>n+t.citations.length,0)}));
  const result = await evaluateSession({session,courtCase,records:[user,...turns.map(t=>({...t,_id:randomUUID()}))]});
  console.log(JSON.stringify({evaluation:'passed',score:result.score,criteria:result.criteria.map(group=>group.id)}));
} catch(error) {
  console.error(JSON.stringify({liveAI:'failed',code:error.code ?? error.name,message:error.name==='AppError'?error.message:'Kiểm thử chưa hoàn thành.'}));
  process.exitCode=1;
} finally { await mongoose.disconnect(); }
