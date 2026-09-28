import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthorityMetadata } from '../data/legalAuthorities.js';
import {
  createProvisionUnits,
  getProvisionLocator,
  getProvisionLocatorKey,
  parseLegalArticles,
} from './legalTextParser.js';
import { getSourceFingerprint } from './legalImportService.js';
import {
  isCitationEligibleOnDate,
  isProvisionEffectiveOn,
  isValidDateOnly,
  validateCitationIds,
} from './legalRetrievalService.js';

const fixture = [
  'Chương I',
  'Điều 1. Phạm vi điều chỉnh',
  'Phạm vi giả định.',
  '1. Khoản thứ nhất.',
  'a) Điểm thứ nhất.',
  'b) Điểm thứ hai.',
  '2. Khoản thứ hai.',
  'Điều 2. Áp dụng',
  'Văn bản giả định.',
].join('\n');

test('parses article, paragraph and point locators without treating cross-references as article headings', () => {
  const source = `${fixture}\nTheo Điều 1 và Điều 2 của văn bản.`;
  const articles = parseLegalArticles(source);

  assert.deepEqual(articles.map((article) => article.article), ['1', '2']);
  const units = createProvisionUnits(articles[0]);
  assert.deepEqual(units.map(({ article, paragraph, point }) => ({ article, paragraph, point })), [
    { article: '1', paragraph: null, point: null },
    { article: '1', paragraph: '1', point: null },
    { article: '1', paragraph: '1', point: 'a' },
    { article: '1', paragraph: '1', point: 'b' },
    { article: '1', paragraph: '2', point: null },
  ]);
  assert.equal(getProvisionLocator(units[2]), 'điểm a khoản 1 Điều 1');
  assert.equal(getProvisionLocatorKey(units[2]), 'A:1|P:1|D:a');
});

test('source fingerprints are stable across repeated imports and input ordering', () => {
  const first = [
    { name: 'part_1.pdf', sha256: 'first' },
    { name: 'part_2.pdf', sha256: 'second' },
  ];
  assert.equal(getSourceFingerprint(first), getSourceFingerprint([...first].reverse()));
  assert.notEqual(getSourceFingerprint(first), getSourceFingerprint([{ name: 'part_1.pdf', sha256: 'changed' }]));
});

test('không gán nhầm khoản khi điều sửa đổi trích lại các khoản cùng số', () => {
  const [article] = parseLegalArticles('Điều 10. Sửa đổi\n1. Sửa nội dung sau:\n1. Khoản được trích lại.\n2. Khoản tiếp theo.');
  const units = createProvisionUnits(article);
  assert.equal(units.length, 1);
  assert.equal(units[0].text, article.text);
});

test('validates real calendar dates and applies inclusive effective dates', () => {
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2025-02-29'), false);
  assert.equal(isValidDateOnly('2025-13-01'), false);
  assert.equal(isValidDateOnly('2025-1-01'), false);
  assert.equal(isProvisionEffectiveOn({ effective_from: '2024-08-01' }, '2024-07-31'), false);
  assert.equal(isProvisionEffectiveOn({ effective_from: '2024-08-01' }, '2024-08-01'), true);
  assert.equal(isProvisionEffectiveOn({ effective_from: '2024-08-01', effective_to: '2025-06-30' }, '2025-07-01'), false);
});

test('excludes amended source editions from citable material until a verified text is imported', () => {
  assert.equal(isCitationEligibleOnDate({ source_status: 'verified_current', effective_from: '2017-01-01' }, '2025-01-01'), true);
  assert.equal(isCitationEligibleOnDate({ source_status: 'verified_current', effective_from: '2017-01-01', verified_through: '2026-09-28' }, '2026-09-29'), false);
  assert.equal(isCitationEligibleOnDate({ source_status: 'amended_text_unavailable', effective_from: '2024-08-01' }, '2025-01-01'), false);
  assert.equal(isCitationEligibleOnDate({ source_status: 'verified_current', effective_from: '2024-08-01' }, '2024-07-31'), false);
  assert.equal(getAuthorityMetadata('31/2024/QH15').amendments[0].effectiveFrom, '2024-08-01');
  assert.deepEqual(getAuthorityMetadata('31/2024/QH15').effectiveRules[0].articles, ['190', '248']);
  assert.equal(getAuthorityMetadata('31/2024/QH15').effectiveRules[0].effectiveFrom, '2024-04-01');
  assert.equal(getAuthorityMetadata('92/2015/QH13').consolidatedSourceUrl.includes('11-vbhn-vpqh'), true);
  assert.equal(getAuthorityMetadata('92/2015/QH13').amendments.at(-1).effectiveFrom, '2025-07-01');
});

test('rejects citations not retrieved and article references not backed by the cited unit', () => {
  const citation = {
    id: 'allowed',
    law_number: '91/2015/QH13',
    article: '3',
    paragraph: '1',
    point: 'a',
  };
  const availableCitations = [citation];

  assert.equal(validateCitationIds({
    content: 'Theo điểm a khoản 1 Điều 3.',
    citationIds: ['allowed'],
    availableCitations,
  }).valid, true);
  assert.equal(validateCitationIds({
    content: 'Theo Điều 3 khoản 1 điểm a.',
    citationIds: ['allowed'],
    availableCitations,
  }).valid, true);
  assert.equal(validateCitationIds({
    content: 'Theo khoản 2 Điều 3.',
    citationIds: ['allowed'],
    availableCitations,
  }).valid, false);
  assert.equal(validateCitationIds({
    content: 'Theo điểm b khoản 1 Điều 3.',
    citationIds: ['allowed'],
    availableCitations,
  }).valid, false);
  assert.equal(validateCitationIds({
    content: 'Theo Điều 3.',
    citationIds: ['not-retrieved'],
    availableCitations,
  }).valid, false);
  assert.equal(validateCitationIds({
    content: 'Theo Điều 4.',
    citationIds: ['allowed'],
    availableCitations,
  }).valid, false);
});

test('điều đầy đủ bao phủ khoản có thật, không chấp nhận khoản bịa hoặc tráo luật', () => {
  const availableCitations = [{ id:'civil',law_number:'91/2015/QH13',article:'3',paragraph:null,point:null,text:'Điều 3. Nguyên tắc\n1. Nội dung khoản một.\n2. Nội dung khoản hai.' }, { id:'other',law_number:'92/2015/QH13',article:'4',paragraph:null,point:null,text:'Điều 4. Nội dung' }];
  assert.equal(validateCitationIds({content:'Theo khoản 2 Điều 3 Bộ luật Dân sự số 91/2015/QH13.',citationIds:['civil'],availableCitations}).valid,true);
  assert.equal(validateCitationIds({content:'Theo khoản 9 Điều 3.',citationIds:['civil'],availableCitations}).valid,false);
  assert.equal(validateCitationIds({content:'Theo Điều 3 của Bộ luật số 92/2015/QH13.',citationIds:['civil','other'],availableCitations}).valid,false);
});

test('không gắn tiêu đề chương và thông tin xuất bản vào điều luật', () => {
  const text = 'Điều 1. Một\n1. Nội dung đúng.\nChương II\nPHẦN HAI\nĐiều 2. Hai\nNội dung cuối.\nLuật này đã được Quốc hội thông qua.\nVĂN PHÒNG CHÍNH PHỦ XUẤT BẢN';
  const articles = parseLegalArticles(text);
  assert.equal(articles.length, 2);
  assert.ok(!articles[0].text.includes('Chương II'));
  assert.ok(!articles[1].text.includes('XUẤT BẢN'));
  assert.ok(articles[1].text.includes('Nội dung cuối.'));
});
