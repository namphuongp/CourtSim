import Case from '../models/Case.js';
import AiPersonal from '../models/AiPersonal.js';
import LegalDocument from '../models/LegalDocument.js';
import LegalProvision from '../models/LegalProvision.js';
import LegalCorpusVersion from '../models/LegalCorpusVersion.js';
import LegalCorpusProvision from '../models/LegalCorpusProvision.js';
import LegalSourceCheck from '../models/LegalSourceCheck.js';
// Chỉ xuất dữ liệu nền, không xuất tài khoản hoặc lịch sử cá nhân.
export const seedModels = [Case, AiPersonal, LegalDocument, LegalProvision, LegalCorpusVersion, LegalCorpusProvision, LegalSourceCheck];
export const seedDirectory = new URL('../data/seed/', import.meta.url);
