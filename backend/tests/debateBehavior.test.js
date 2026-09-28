import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleLandCase } from '../src/data/sampleLandCase.js';
import { caseKnowledge, validateCaseFacts } from '../src/services/caseKnowledge.js';
import { evidenceInventory, validateEvidenceReferences } from '../src/services/caseEvidence.js';
import { learnerRecord } from '../src/services/learnerPresentation.js';
import { dialogueText } from '../../shared/dialogueText.mjs';
import { dialogueProblem } from '../src/services/debatePolicy.js';
process.env.JWT_SECRET = 'test-only-secret-not-used-by-real-deployments';
const { generateDebateTurn, validateFactAnchors } = await import('../src/services/simulationService.js');
const courtCase = { _id: 'land-test', ...sampleLandCase };
const noLaw = { citations: [], candidates: [], issues: [], warnings: ['Chưa xác minh được căn cứ pháp luật'], legal_assessment_available: false };
const emptyFacts = { established_facts: [], learner_claims: [], inferences: [], missing_facts: [] };

test('phân loại hồ sơ: bản án ghi nhận tranh chấp, yêu cầu/lời B không phải sự thật, tài liệu chưa có bản gốc vẫn có nội dung thuật lại', () => {
  assert.equal(validateCaseFacts(courtCase).length,4);
  const facts=caseKnowledge(courtCase);
  assert.equal(facts.recorded_events[0].quote,'Hai bên tranh chấp 229,7 m² đất mương và bờ mương.');
  assert.ok(facts.party_statements.some(f=>f.party==='B'));
  assert.equal(facts.mentioned_documents.length,4);
  assert.equal(facts.supplied_documents.length,0);
  assert.equal(facts.unproven.length,1);
  assert.throws(()=>validateCaseFacts({...courtCase,case_facts:[{kind:'recorded_event',quote:'B cho rằng đất có nguồn gốc từ gia đình mình và đã sử dụng lâu dài.',source_type:'judgment'}]}));
  assert.throws(()=>validateFactAnchors({...emptyFacts,established_facts:['đất có nguồn gốc từ gia đình mình và đã sử dụng lâu dài.']},courtCase,[]),/Lời trình bày/);
  const legacy=caseKnowledge({...courtCase,case_facts:undefined});
  assert.equal(legacy.recorded_events.length,0);
  assert.ok(legacy.party_statements.some(f=>f.quote.includes('B cho rằng')));
});

test('lời thoại cũ không lộ ID/trạng thái/phân tích nội bộ; dữ liệu gốc và ID giữ để đối chiếu',()=>{
  const evidence=evidenceInventory(courtCase)[0];
  const content=`Theo [CC:${evidence.id}], tình trạng mentioned_only, cần đối chiếu phạm vi giấy chứng nhận.`;
  const view=learnerRecord({sender_type:'ai_judge',content,fact_analysis:emptyFacts,dialogue_focus:{internal:true}},courtCase);
  assert.match(view.content,/Giấy chứng nhận/);
  assert.doesNotMatch(view.content,/\[CC:|EV-|mentioned_only/);
  assert.equal(view.fact_analysis,undefined); assert.equal(view.dialogue_focus,undefined);
  assert.equal(learnerRecord({sender_type:'user',content},courtCase).content,content);
  assert.equal(dialogueText('Tài liệu EV-notfound và [CC:EV-nope] là mentioned_only'), 'Tài liệu tài liệu được viện dẫn và tài liệu được viện dẫn là được bản án đề cập');
  assert.deepEqual(validateEvidenceReferences(courtCase,`[Chứng cứ: ${evidence.name}] Nội dung lập luận`,[evidence.id]),[evidence.id]);
  assert.throws(()=>validateEvidenceReferences(courtCase,'[Chứng cứ: Tài liệu khác]',[evidence.id]));
});

test('229,7 m² qua hai lượt: sửa cảnh báo lặp, phản biện cụ thể, Thẩm phán hỏi mới dù chưa có luật được duyệt',async()=>{
  const records=[{_id:'old',sender_type:'ai_judge',content:'Chưa có bản gốc chứng cứ. Chưa xác minh được căn cứ pháp luật.'}];
  const learners=[
    'Tôi bảo vệ bị đơn B: giấy chứng nhận năm 1996 chưa cho thấy toàn bộ 229,7 m² nằm trong ranh giới được cấp; quá trình gia đình B sử dụng lâu dài cần được xem xét.',
    'Tôi không coi sử dụng lâu dài tự chứng minh quyền sử dụng đất; tôi cho rằng lời khai nhân chứng không thống nhất làm yếu suy luận về nguồn gốc của nguyên đơn.'
  ];
  const answers=[
    'Bạn cho rằng giấy chứng nhận chưa thể hiện toàn bộ 229,7 m² nên cần xem xét quá trình sử dụng của B. Theo nội dung bản án, A viện dẫn giấy chứng nhận cấp năm 1996; đây là căn cứ mà phía nguyên đơn có thể dùng để phản bác việc chỉ dựa vào sử dụng lâu dài. Lời B về nguồn gốc gia đình chưa tự chứng minh quyền đối với phần đất tranh chấp. Nếu phạm vi giấy chứng nhận bao gồm phần đất ấy, lập luận của A mạnh hơn; nếu không, A cần giải thích căn cứ liên hệ giấy chứng nhận với diện tích yêu cầu. Việc sử dụng lâu dài của B vì thế cần được phân tích riêng với phạm vi giấy chứng nhận.',
    'Bạn chuyển sang mâu thuẫn trong lời khai nhân chứng. Mâu thuẫn có thể làm giảm sức thuyết phục của lời kể về nguồn gốc nhưng chưa tự phủ nhận nội dung giấy chứng nhận mà A viện dẫn. Nếu mâu thuẫn liên quan trực tiếp đến vị trí phần đất, lập luận của B có thêm sức nặng; nếu chỉ liên quan chi tiết phụ, nó chưa đủ làm yếu liên hệ giữa giấy chứng nhận và diện tích A yêu cầu. Phía nguyên đơn vẫn có thể yêu cầu phân biệt hai loại mâu thuẫn đó.'
  ];
  const questions=['Bạn phân biệt phạm vi giấy chứng nhận với quá trình sử dụng đất khi bảo vệ B như thế nào?','Mâu thuẫn nào trong lời khai ảnh hưởng trực tiếp đến suy luận về nguồn gốc đất mà bạn vừa phản biện?'];
  let index=0, repairs=0;
  const deps={research:async()=>noLaw,persona:async role=>({model_id:role,system_prompt:'Persona cũ yêu cầu đủ tài liệu.',temperature:0.2}),complete:async input=>{
    assert.match(input.systemPrompt,/KHÔNG yêu cầu có bản gốc mọi tài liệu/);
    assert.doesNotMatch(input.systemPrompt,/phải nói chưa xác minh được căn cứ pháp luật/);
    const judge=input.model==='judge';
    const data=JSON.parse(input.systemPrompt.split('<UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[1].split('</UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[0]);
    if(judge) assert.equal(data.recentProceedings.at(-1).speaker_type,'ai_prosecutor');
    const repeated=!judge && index===0 && repairs++===0;
    return JSON.stringify({content:repeated?'Chưa có bản gốc chứng cứ. Chưa xác minh được căn cứ pháp luật.':judge?`${index===0?'Chưa ghi nhận sự thống nhất về phạm vi giấy chứng nhận đối với 229,7 m². Điểm cần tách là phạm vi đất và lời trình bày về sử dụng.':'B đã làm rõ rằng thời gian sử dụng không tự chứng minh quyền. Hai bên còn tranh luận về tác động của mâu thuẫn trong lời khai.'} ${questions[index]}`:answers[index],fact_analysis:emptyFacts,citation_ids:[],dialogue_focus:{learner_quote:learners[index].slice(0,50),dossier_quote:'A yêu cầu trả 229,7 m²; viện dẫn giấy chứng nhận cấp cho hộ gia đình năm 1996.',next_question:judge?questions[index]:''}});
  }};
  for(index=0;index<2;index++) {
    records.push({_id:`u${index}`,sender_type:'user',content:learners[index]});
    const turns=await generateDebateTurn({session:{user_court_role:'defense_lawyer',difficulty:'balanced',case_event_date:'2024-03-29'},courtCase,records},deps);
    assert.equal(turns.length,2);
    assert.equal(turns[0].generation_mode,undefined);
    for(const turn of turns) { assert.doesNotMatch(turn.content,/Chưa có bản gốc|Chưa xác minh được|mentioned_only|\[CC:|EV-/); assert.deepEqual(turn.citations,[]); }
    assert.match(turns[0].content,index===0?/229,7 m²/:/Mâu thuẫn/);
    assert.equal((turns[1].content.match(/\?/g)??[]).length,1);
    assert.ok(turns[1].content.endsWith(questions[index]));
    records.push(...turns);
  }
  assert.equal(repairs,2);
});

test('Thẩm phán không hỏi lại câu phía đối lập vừa hỏi; không chấp nhận điểm bám bịa',()=>{
  const user={sender_type:'user',content:'Tôi đề nghị xem xét phạm vi diện tích 229,7 m².'};
  const question='Bạn giải thích phạm vi của giấy chứng nhận như thế nào?';
  const turn={content:question,dialogue_focus:{learner_quote:user.content,dossier_quote:courtCase.summary,next_question:question}};
  assert.match(dialogueProblem(turn,'judge',[user,{sender_type:'ai_prosecutor',content:question}],courtCase),/lặp|đã được nêu/);
  assert.match(dialogueProblem({...turn,dialogue_focus:{...turn.dialogue_focus,dossier_quote:'Bản đo đạc xác nhận đất thuộc B'}},'judge',[user],courtCase),/trích đoạn/);
});

test('AI vẫn lặp sau lần sửa: tiếp tục có điều kiện từ hồ sơ, số lần gọi bị giới hạn',async()=>{
  let calls=0;
  const content='Tôi bảo vệ B đối với 229,7 m² và đề nghị phân biệt giấy chứng nhận với lời trình bày về sử dụng đất.';
  const turns=await generateDebateTurn({session:{case_event_date:'2024-03-29',user_court_role:'defense_lawyer',difficulty:'balanced'},courtCase,records:[{_id:'u',sender_type:'user',content}]},{persona:async()=>({model_id:'test'}),research:async()=>noLaw,complete:async()=>{calls++;return JSON.stringify({content:'Chưa có bản gốc chứng cứ. Chưa thể kết luận.',citation_ids:[],fact_analysis:emptyFacts,dialogue_focus:{learner_quote:content,dossier_quote:courtCase.summary,next_question:''}});}});
  assert.equal(calls,4);
  assert.equal(turns[0].generation_mode,'guided_continuation');
  assert.equal(turns[1].generation_mode,'guided_continuation');
  assert.match(turns[0].content,/229,7 m²/);
  assert.match(turns[0].content,/Nếu/);
  assert.doesNotMatch(turns.map(t=>t.content).join(' '),/Chưa có bản gốc|chưa thể kết luận|\[CC:|mentioned_only/);
  assert.equal((turns[1].content.match(/\?/g)??[]).length,1);
  assert.equal(learnerRecord(turns[0],courtCase).generation_mode,undefined);
});
