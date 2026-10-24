#!/usr/bin/env node
// Nhập tất cả LegalCorpusProvision và LegalProvision vào Qdrant vector store.
// Chạy: node src/scripts/embedLegalCorpus.js [--reset] [--collection corpus|legacy|all]
// --reset: xóa collection cũ rồi tạo lại.
// --collection: chọn collection cần nhập (mặc định: all).

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import LegalCorpusVersion from '../models/LegalCorpusVersion.js';
import LegalCorpusProvision from '../models/LegalCorpusProvision.js';
import { LegalDocument, LegalProvision } from '../models/index.js';
import { embedBatch, embeddingConfig } from '../services/embeddingService.js';
import {
  ensureCollection, createPayloadIndex, deleteCollection,
  upsertPoints, countPoints, isQdrantAvailable, qdrantConfig,
} from '../services/vectorStore.js';

const CORPUS_COLLECTION = 'legal_provisions_corpus';
const LEGACY_COLLECTION = 'legal_provisions_legacy';
const EMBED_BATCH_SIZE = 32;

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    reset: args.includes('--reset'),
    collection: args.find((_, i, a) => a[i - 1] === '--collection') ?? 'all',
  };
}

async function embedAndUpsert(collection, provisions, documentMap) {
  let total = 0;
  for (let i = 0; i < provisions.length; i += EMBED_BATCH_SIZE) {
    const batch = provisions.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map(p => {
      const doc = documentMap.get(String(p.document_id));
      // Ghép metadata vào text để embedding hiểu ngữ cảnh tốt hơn.
      return [doc?.title, p.locator, p.text].filter(Boolean).join(' — ');
    });

    const embeddings = await embedBatch(texts, 'passage');

    const points = batch.map((p, idx) => {
      const doc = documentMap.get(String(p.document_id));
      return {
        id: String(p._id),
        vector: embeddings[idx],
        payload: {
          document_id: String(p.document_id),
          law_number: doc?.law_number ?? '',
          title: doc?.title ?? '',
          article: p.article ?? '',
          paragraph: p.paragraph ?? null,
          point: p.point ?? null,
          locator: p.locator ?? '',
          locator_key: p.locator_key ?? '',
          text_preview: (p.text ?? '').slice(0, 500),
          text_length: (p.text ?? '').length,
          // Metadata cho filter.
          permission_status: doc?.permission_status ?? doc?.source_status ?? '',
          status: doc?.status ?? '',
          source_verification: doc?.source_verification ?? '',
          collection: collection === CORPUS_COLLECTION ? 'corpus' : 'legacy',
        },
      };
    });

    await upsertPoints(collection, points);
    total += points.length;
    process.stdout.write(`\r  ${collection}: ${total}/${provisions.length} provisions embedded`);
  }
  console.log();
  return total;
}

async function importCorpus(reset) {
  console.log(`\n📚 Nhập kho luật mới (LegalCorpusVersion → ${CORPUS_COLLECTION})`);
  const documents = await LegalCorpusVersion.find({
    status: { $in: ['verified', 'reference'] },
    permission_status: 'allowed',
    retired_at: null,
  }).lean();
  console.log(`  Tìm thấy ${documents.length} văn bản hợp lệ.`);
  if (!documents.length) return 0;

  const docMap = new Map(documents.map(d => [String(d._id), d]));
  const provisions = await LegalCorpusProvision.find({
    document_id: { $in: documents.map(d => d._id) },
  }).lean();
  console.log(`  Tìm thấy ${provisions.length} điều khoản.`);
  if (!provisions.length) return 0;

  // Lấy kích thước vector từ embedding thử.
  const [testVec] = await embedBatch(['kiểm tra'], 'passage');
  const vectorSize = testVec.length;
  console.log(`  Vector size: ${vectorSize}`);

  if (reset) await deleteCollection(CORPUS_COLLECTION);
  await ensureCollection(CORPUS_COLLECTION, vectorSize);
  await createPayloadIndex(CORPUS_COLLECTION, 'law_number', 'keyword');
  await createPayloadIndex(CORPUS_COLLECTION, 'permission_status', 'keyword');
  await createPayloadIndex(CORPUS_COLLECTION, 'status', 'keyword');
  await createPayloadIndex(CORPUS_COLLECTION, 'article', 'keyword');
  await createPayloadIndex(CORPUS_COLLECTION, 'collection', 'keyword');

  return embedAndUpsert(CORPUS_COLLECTION, provisions, docMap);
}

async function importLegacy(reset) {
  console.log(`\n📜 Nhập kho luật cũ (LegalDocument → ${LEGACY_COLLECTION})`);
  const documents = await LegalDocument.find().lean();
  console.log(`  Tìm thấy ${documents.length} văn bản.`);
  if (!documents.length) return 0;

  const docMap = new Map(documents.map(d => [String(d._id), d]));
  const provisions = await LegalProvision.find({
    document_id: { $in: documents.map(d => d._id) },
  }).lean();
  console.log(`  Tìm thấy ${provisions.length} điều khoản.`);
  if (!provisions.length) return 0;

  const [testVec] = await embedBatch(['kiểm tra'], 'passage');
  const vectorSize = testVec.length;

  if (reset) await deleteCollection(LEGACY_COLLECTION);
  await ensureCollection(LEGACY_COLLECTION, vectorSize);
  await createPayloadIndex(LEGACY_COLLECTION, 'law_number', 'keyword');
  await createPayloadIndex(LEGACY_COLLECTION, 'permission_status', 'keyword');
  await createPayloadIndex(LEGACY_COLLECTION, 'article', 'keyword');
  await createPayloadIndex(LEGACY_COLLECTION, 'collection', 'keyword');

  return embedAndUpsert(LEGACY_COLLECTION, provisions, docMap);
}

async function main() {
  const { reset, collection } = parseArgs();
  console.log('🔧 Cấu hình embedding:', embeddingConfig());
  console.log('🔧 Cấu hình Qdrant:', qdrantConfig());

  if (!await isQdrantAvailable()) {
    console.error('❌ Không kết nối được Qdrant. Kiểm tra QDRANT_URL và Qdrant đang chạy.');
    process.exit(1);
  }
  console.log('✅ Qdrant khả dụng.');

  await mongoose.connect(env.MONGO_URI);
  console.log('✅ MongoDB đã kết nối.');

  let totalCorpus = 0, totalLegacy = 0;
  if (collection === 'all' || collection === 'corpus') {
    totalCorpus = await importCorpus(reset);
  }
  if (collection === 'all' || collection === 'legacy') {
    totalLegacy = await importLegacy(reset);
  }

  // Báo cáo cuối cùng.
  console.log('\n📊 Kết quả:');
  if (totalCorpus) {
    const count = await countPoints(CORPUS_COLLECTION);
    console.log(`  ${CORPUS_COLLECTION}: ${count} points`);
  }
  if (totalLegacy) {
    const count = await countPoints(LEGACY_COLLECTION);
    console.log(`  ${LEGACY_COLLECTION}: ${count} points`);
  }
  console.log(`\n✅ Hoàn tất. Tổng: ${totalCorpus + totalLegacy} provisions đã nhúng.`);

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ Lỗi:', error);
  process.exit(1);
});
