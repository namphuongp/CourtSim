import test from 'node:test';
import assert from 'node:assert/strict';
import {rankProvisions} from './legalRetrievalService.js';
import {getLegalSearchTerms} from './legalTextSearch.js';

test('xếp hạng ưu tiên chủ đề vay, không nhầm từ chấp trong tranh chấp và thế chấp',()=>{
 const texts=['Điều 1. Hợp đồng vay tài sản\nBên vay hoàn trả tài sản.', 'Điều 2. Thế chấp tài sản\nCác bên thỏa thuận hợp đồng về tài sản và yêu cầu thanh toán.', 'Điều 3. Giám hộ\nNgười giám hộ bảo vệ quyền lợi và sử dụng tài sản.'];
 const provisions=texts.map(text=>({text,search_tokens:getLegalSearchTerms(text)}));
 const ranked=rankProvisions(provisions,{title:'Tranh chấp hợp đồng vay tài sản',summary:'Bị đơn khai đã trả tiền.'});
 assert.equal(ranked[0].provision.text,texts[0]);
});
