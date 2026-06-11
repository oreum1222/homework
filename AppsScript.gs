/**
 * 오름 국어 · 방학 숙제 진단 시스템 — Google Apps Script 백엔드
 * ─────────────────────────────────────────────────────────────────────
 * 기능: ① 학생 제출 누적(doPost)  ② 대시보드 조회(doGet ?action=list)
 *       ③ 명단 조회(doGet ?action=roster)  ④ 문자/알림톡 발송(doPost action=sendMessages)
 *
 * [Solapi 발송 설정 — 프로젝트 설정(⚙) → 스크립트 속성에 추가]
 *   SOLAPI_KEY     : Solapi API Key
 *   SOLAPI_SECRET  : Solapi API Secret
 *   SOLAPI_SENDER  : 사전 등록한 발신번호 (예: 01012345678)
 *   SOLAPI_PFID    : (선택) 알림톡 발신프로필 ID
 *   ※ KEY/SECRET/SENDER 가 없으면 발송은 자동으로 '테스트 모드'로 동작(실제 발송 X).
 *
 * [배포] URL 유지하려면 '배포 관리 → 편집(연필) → 새 버전 → 배포'
 */

var SHEET_NAME   = '제출';
var ROSTER_SHEET = '명단';
var LOG_SHEET    = '발송로그';

var HEADERS = [
  'timestamp','courseId','courseLabel','week','weekLabel','month','area',
  'name','school','grade',
  '원점수','만점','정답률','맞은개수','틀린개수','총문항',
  '틀린문항','핵심패턴','강점','학습진단',
  '완수상태','완수예정일','완수약속','제출시점','미완사유','성실도','제출방식',
  'patternsJson','strengthsJson','areaStatJson','wrongDetailsJson','studyDiagJson','studyAnsJson'
];
var ROSTER_HEADERS = ['courseId','name','school','guardianName','guardianPhone','studentPhone','consent','memo'];
var LOG_HEADERS    = ['timestamp','courseId','name','phone','channel','scenario','message','result','messageId','error'];
var PENDING_SHEET  = '발송대기';
var PENDING_HEADERS= ['생성일','scenario','name','phone','courseId','weekLabel','message','status'];
// 자동발송용 브랜드/교사명 (config.js 와 별개로 GAS에서 직접 사용)
var BRAND_NAME = '김가경 국어 연구소';
var TEACHER_NAME = '가경T';
var DONE_MAP = {'전부 끝냄':100,'대부분(70% 이상)':85,'절반쯤':50,'조금만(30% 이하)':25,'아직 시작 못 함':0};

// ════════════════════════ 라우팅 ════════════════════════
function doPost(e){
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'sendMessages') return handleSend_(params);
  if (params.action === 'markSent')     return handleMarkSent_(params);
  if (params.action === 'oathSend')     return handleOathSend_(params);
  return handleSubmit_(params);   // 기본: 학생 제출 누적
}
function doGet(e){
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'roster')  return json_(readRoster_());
  if (action === 'pending') return json_(readPending_());
  if (action === 'list')    return json_(readAll_());
  return json_({ ok:true, msg:'오름 숙제 진단 백엔드 정상 작동 중' });
}

// ★ 권한 승인 전용: 편집기에서 이 함수를 1회 실행 → '허용'만 누르면 외부발송+메일 권한이 부여됩니다.
function authorizeExternal(){
  try { UrlFetchApp.fetch('https://api.solapi.com/cash/v1/balance', { muteHttpExceptions:true }); } catch(e){}
  try { MailApp.getRemainingDailyQuota(); } catch(e){}   // 자동발송 알림 메일 권한(send_mail)
  return '권한 승인 완료';
}

// ════════════════════════ ① 제출 누적 ════════════════════════
function handleSubmit_(params){
  try{
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    var sheet = getSheet_(SHEET_NAME, HEADERS);
    var lastCol = sheet.getLastColumn();
    var header = lastCol > 0 ? sheet.getRange(1,1,1,lastCol).getValues()[0] : [];
    header = header.filter(function(h){ return h !== '' && h !== null; });
    var want = HEADERS.slice();
    Object.keys(params).forEach(function(k){ if(want.indexOf(k) < 0 && k !== 'action') want.push(k); });
    var changed = false;
    want.forEach(function(h){ if(header.indexOf(h) < 0){ header.push(h); changed = true; } });
    if(changed || lastCol === 0){ sheet.getRange(1,1,1,header.length).setValues([header]); sheet.setFrozenRows(1); }
    var row = header.map(function(h){ return params[h] !== undefined ? params[h] : ''; });
    sheet.appendRow(row); lock.releaseLock();
    return json_({ ok:true });
  }catch(err){ return json_({ ok:false, error:String(err) }); }
}

// ════════════════════════ ② 발송 (문자/알림톡) ════════════════════════
function handleSend_(params){
  try{
    var messages = JSON.parse(params.messages || '[]');     // [{to,text,name,scenario,courseId,channel?,kakao?}]
    if(!messages.length) return json_({ ok:false, error:'발송할 메시지가 없습니다.' });

    var props  = PropertiesService.getScriptProperties();
    var key    = props.getProperty('SOLAPI_KEY');
    var secret = props.getProperty('SOLAPI_SECRET');
    var sender = props.getProperty('SOLAPI_SENDER');
    var hasKeys = !!(key && secret && sender);
    var dryRun  = (params.dryRun === '1') || !hasKeys;       // 키 없으면 강제 테스트 모드

    var results = [];

    if(dryRun){
      messages.forEach(function(m){
        results.push({ to:m.to, name:m.name, ok:true, dry:true });
        logSend_(m, '테스트', '테스트', '', '');
      });
      return json_({ ok:true, dryRun:true, hasKeys:hasKeys, sent:0, count:messages.length, results:results });
    }

    // ── 실제 발송: Solapi send-many/detail (한 번에 전송) ──
    var payload = { messages: messages.map(function(m){
      var msg = { to: digits_(m.to), from: digits_(sender), text: m.text };
      if(m.kakao && m.kakao.templateId){                    // 알림톡(선택) → 실패 시 문자 폴백
        msg.kakaoOptions = {
          pfId: m.kakao.pfId || props.getProperty('SOLAPI_PFID') || '',
          templateId: m.kakao.templateId,
          variables: m.kakao.variables || {},
          disableSms: false
        };
      }
      return msg;
    })};

    var res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method:'post', contentType:'application/json',
      headers:{ Authorization: solapiAuth_(key, secret) },
      payload: JSON.stringify(payload), muteHttpExceptions:true
    });
    var code = res.getResponseCode();
    var body = {}; try{ body = JSON.parse(res.getContentText() || '{}'); }catch(_){ body = {}; }

    if(code >= 300){
      var emsg = (body && (body.errorMessage || body.message)) || ('HTTP '+code);
      messages.forEach(function(m){ results.push({ to:m.to, name:m.name, ok:false, error:emsg }); logSend_(m, m.channel||'문자', '실패', '', emsg); });
      return json_({ ok:false, dryRun:false, error:emsg, results:results });
    }

    var failed = {};
    (body.failedMessageList || []).forEach(function(f){ failed[digits_(f.to)] = (f.statusMessage || f.statusCode || '실패'); });
    var gid = (body.groupInfo && body.groupInfo.groupId) || '';
    var ok = 0;
    messages.forEach(function(m){
      var er = failed[digits_(m.to)];
      if(er){ results.push({ to:m.to, name:m.name, ok:false, error:er }); logSend_(m, m.channel||'문자', '실패', gid, er); }
      else  { results.push({ to:m.to, name:m.name, ok:true }); logSend_(m, m.channel||'문자', '성공', gid, ''); ok++; }
    });
    return json_({ ok:true, dryRun:false, sent:ok, count:messages.length, groupId:gid, results:results });

  }catch(err){ return json_({ ok:false, error:String(err) }); }
}

// ════════════════════════ 각서 자동발송 (학생 제출 즉시 학부모+본인) ════════════════════════
// 보안: 클라이언트가 번호를 못 정함. 서버가 '명단'에서 이름으로 본인 연락처를 찾아 그 번호로만 발송.
function handleOathSend_(params){
  try{
    var name=String(params.name||'').trim();
    var due =String(params.dueDate||'').trim();
    if(!name) return json_({ ok:false, error:'이름이 없습니다.' });

    var roster=readRoster_(), match=null, nn=normName_(name);
    for(var i=0;i<roster.length;i++){ if(normName_(roster[i].name)===nn){ match=roster[i]; break; } }
    var phones=[];
    if(match){
      var gp=String(match.guardianPhone||'').replace(/[^0-9]/g,''); if(gp) phones.push(gp);
      var sp=String(match.studentPhone||'').replace(/[^0-9]/g,'');  if(sp && phones.indexOf(sp)<0) phones.push(sp);
    }
    if(!phones.length) return json_({ ok:false, error:'명단에서 '+name+' 학생의 연락처를 찾지 못했습니다.' });

    var text=oathText_(name, due);
    var props=PropertiesService.getScriptProperties();
    var key=props.getProperty('SOLAPI_KEY'), secret=props.getProperty('SOLAPI_SECRET'), sender=props.getProperty('SOLAPI_SENDER');

    if(!(key&&secret&&sender)){   // 키 없으면 테스트(실발송X)
      phones.forEach(function(p){ logSend_({to:p,name:name,scenario:'oath',courseId:params.courseId||'',text:text},'테스트','테스트','',''); });
      return json_({ ok:true, dryRun:true, sentTo:phones });
    }
    var payload={ messages: phones.map(function(p){ return { to:p, from:digits_(sender), text:text }; }) };
    var res=UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail',{
      method:'post', contentType:'application/json',
      headers:{ Authorization: solapiAuth_(key,secret) }, payload:JSON.stringify(payload), muteHttpExceptions:true });
    var code=res.getResponseCode(); var body={}; try{ body=JSON.parse(res.getContentText()||'{}'); }catch(_){}
    var gid=(body.groupInfo&&body.groupInfo.groupId)||'';
    if(code>=300){
      var em=(body&&(body.errorMessage||body.message))||('HTTP '+code);
      phones.forEach(function(p){ logSend_({to:p,name:name,scenario:'oath',courseId:params.courseId||'',text:text},'문자','실패',gid,em); });
      return json_({ ok:false, error:em });
    }
    var failed={}; (body.failedMessageList||[]).forEach(function(f){ failed[digits_(f.to)]=(f.statusMessage||'실패'); });
    phones.forEach(function(p){ var er=failed[digits_(p)]; logSend_({to:p,name:name,scenario:'oath',courseId:params.courseId||'',text:text},'문자',er?'실패':'발송',gid,er||''); });
    return json_({ ok:true, sentTo:phones, groupId:gid });
  }catch(err){ return json_({ ok:false, error:String(err) }); }
}
function oathText_(name, due){
  return '[' + BRAND_NAME + '] 각서\n\n'
    + '나, ' + name + '은(는) 숙제를 안 해 온 오늘의 나를 솔직히 인정합니다.\n\n'
    + '숙제를 안 하면 그 순간은 편하지만, 복습을 제때 못 해 다음 수업 이해가 어렵고, 수업은 들었으나 남는 게 없어 결국 손해 보는 사람은 나라는 것도 알고 있습니다.\n\n'
    + '다시 숙제를 안 해 올 경우 "깜빡했어요·시간이 없었어요·했는데 두고 왔어요" 같은 인류 공통의 변명을 잠시 내려놓고, 밀린 숙제부터 조용히 해결하겠습니다.\n\n'
    + '숙제 완료 기한: ' + (due || '(미정)') + '\n\n'
    + '* 지금의 숙제가 정말 버겁다면 ' + TEACHER_NAME + '에게 꼭 연락주세요. 상황을 헤아려 적정한 양으로 줄여드립니다. (진심입니다)';
}

// Solapi HMAC-SHA256 인증 헤더
function solapiAuth_(key, secret){
  var date = new Date().toISOString();
  var salt = Utilities.getUuid().replace(/-/g, '');
  var raw  = Utilities.computeHmacSha256Signature(date + salt, secret);
  var hex  = raw.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
  return 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + hex;
}
function digits_(s){ return String(s||'').replace(/[^0-9]/g, ''); }
// 이름 정규화(매칭용): 공백·대괄호·괄호 문자 제거 → "[실험용]"==="실험용", " 홍 길동 "==="홍길동"
function normName_(s){ return String(s||'').replace(/[\s\[\]（）()｛｝{}]/g,''); }

function logSend_(m, channel, result, messageId, error){
  try{
    var sh = getSheet_(LOG_SHEET, LOG_HEADERS);
    sh.appendRow([ new Date(), m.courseId||'', m.name||'', maskPhone_(m.to), channel||'', m.scenario||'',
      String(m.text||'').slice(0,180), result||'', messageId||'', error||'' ]);
  }catch(_){}
}
function maskPhone_(p){ p=digits_(p); return p.length>=7 ? p.slice(0,3)+'****'+p.slice(-4) : p; }

// ════════════════════════ 자동발송(반자동) — 주간 다이제스트 ════════════════════════
// 매주 트리거로 실행: 최신 주차 기준 '미완 독려'+'주간 요약' 대상을 만들어 '발송대기' 시트에 적재 + 교사 메일 알림.
// 실제 발송은 대시보드 '자동발송 대기함'에서 교사가 확인 후 진행(반자동).
function weeklyDigest(){
  var subs = readAll_();
  var roster = readRoster_();
  if(!subs.length || !roster.length) return '데이터 없음';

  var latest = 0;
  subs.forEach(function(r){ var w=Number(r.week)||0; if(w>latest) latest=w; });
  var weekLabel='', byName={};
  subs.forEach(function(r){
    if((Number(r.week)||0)===latest){ byName[normName_(r.name)]=r; if(!weekLabel) weekLabel=String(r.weekLabel||('주차 '+latest)); }
  });

  var pending=[], undoneN=0, sumN=0;
  roster.forEach(function(p){
    var name=String(p.name||'').trim();
    var gp=digits_(p.guardianPhone||''), sp=digits_(p.studentPhone||'');   // 학부모/학생 번호
    var consent=String(p.consent||'').toUpperCase();
    if(!name || (!gp && !sp)) return;
    if(consent==='N'||consent==='NO'||consent.indexOf('미동의')>=0||consent.indexOf('거부')>=0) return;
    var sub=byName[normName_(name)];
    var doneLabel = sub ? String(sub['완수상태']||'') : '';
    var doneRate  = (DONE_MAP[doneLabel]!=null) ? DONE_MAP[doneLabel] : (sub?'':0);
    var rate = sub ? String(sub['정답률']||'') : '';
    var doneTxt = (doneRate==='')?'-':(doneRate+'%');
    var rateTxt = rate===''? '-' : (String(rate).indexOf('%')>=0?rate:rate+'%');

    // 미완 독려 → 학생에게 (학생 번호 없으면 학부모로 대체)
    if(!sub || (DONE_MAP[doneLabel]!=null && DONE_MAP[doneLabel]<100)){
      var toU = sp || gp;
      if(toU){
        var t='['+BRAND_NAME+'] '+name+' 학생, 이번 '+weekLabel+' 과제 완수율이 '+doneTxt+'입니다. 약속한 기한까지 꼭 마무리합시다. ('+TEACHER_NAME+')';
        pending.push([new Date(),'undone',name,toU,p.courseId||'',weekLabel,t,'대기']); undoneN++;
      }
    }
    // 주간 요약 → 학부모 + 학생 둘 다
    if(sub){
      var t2='['+BRAND_NAME+'] '+name+' 학생 '+weekLabel+' 과제 결과 안내 — 평균 정답률 '+rateTxt+', 완수율 '+doneTxt+'. 자세한 내용은 가정통신문을 확인해 주세요. ('+TEACHER_NAME+')';
      [gp,sp].forEach(function(ph){ if(ph) pending.push([new Date(),'summary',name,ph,p.courseId||'',weekLabel,t2,'대기']); });
      sumN++;
    }
  });

  // '발송대기' 시트: 머리글만 남기고 비운 뒤 이번 주 대기 적재(이번 주 큐)
  var sh=getSheet_(PENDING_SHEET, PENDING_HEADERS);
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,PENDING_HEADERS.length).clearContent();
  if(pending.length) sh.getRange(2,1,pending.length,pending[0].length).setValues(pending);

  // 교사 메일 알림
  try{
    var to=Session.getEffectiveUser().getEmail();
    if(to){
      MailApp.sendEmail(to,
        '[숙제시스템] '+weekLabel+' 자동발송 대기 '+pending.length+'건',
        weekLabel+' 자동발송 대기가 준비됐습니다.\n'
        +'· 미완 독려: '+undoneN+'명\n· 주간 요약: '+sumN+'명\n\n'
        +'대시보드 → 문자 발송 → "자동발송 대기함"에서 검토 후 발송하세요.\n');
    }
  }catch(e){}
  return '대기 '+pending.length+'건 준비(미완 '+undoneN+', 요약 '+sumN+')';
}
function readPending_(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName(PENDING_SHEET);
  if(!sh) return [];
  var v=sh.getDataRange().getValues();
  if(v.length<2) return [];
  var head=v[0], out=[];
  for(var i=1;i<v.length;i++){
    if(String(v[i][7]||'')!=='대기') continue;   // status
    var o={}; for(var j=0;j<head.length;j++) o[head[j]]=v[i][j];
    o._row=i+1; out.push(o);
  }
  return out;
}
// 대시보드에서 발송 완료한 대기 항목을 '발송완료'로 표시 (keys = "phone|scenario" 배열)
function handleMarkSent_(params){
  try{
    var keys=JSON.parse(params.keys||'[]'); var set={}; keys.forEach(function(k){ set[k]=1; });
    var ss=SpreadsheetApp.getActiveSpreadsheet(); var sh=ss.getSheetByName(PENDING_SHEET);
    if(!sh) return json_({ok:true,updated:0});
    var v=sh.getDataRange().getValues(), upd=0;
    for(var i=1;i<v.length;i++){
      var key=String(v[i][3]).replace(/[^0-9]/g,'')+'|'+String(v[i][1]);   // phone|scenario
      if(set[key] && String(v[i][7])==='대기'){ sh.getRange(i+1,8).setValue('발송완료'); upd++; }
    }
    return json_({ok:true,updated:upd});
  }catch(err){ return json_({ok:false,error:String(err)}); }
}

// ════════════════════════ ③ 명단 조회 ════════════════════════
function readRoster_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ROSTER_SHEET);
  if(!sh){ sh = ss.insertSheet(ROSTER_SHEET); sh.appendRow(ROSTER_HEADERS); sh.setFrozenRows(1); return []; }
  var values = sh.getDataRange().getValues();
  if(values.length < 2) return [];
  var head = values[0], out = [];
  for(var i=1;i<values.length;i++){
    var obj = {}, blank = true;
    for(var j=0;j<head.length;j++){ obj[head[j]] = values[i][j]; if(values[i][j] !== '') blank = false; }
    if(!blank) out.push(obj);
  }
  return out;
}

// ════════════════════════ 공통 ════════════════════════
function getSheet_(name, headers){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if(!sheet){ sheet = ss.insertSheet(name); sheet.appendRow(headers); sheet.setFrozenRows(1); }
  else if(sheet.getLastRow() === 0){ sheet.appendRow(headers); sheet.setFrozenRows(1); }
  return sheet;
}
function readAll_(){
  var sheet = getSheet_(SHEET_NAME, HEADERS);
  var values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  var head = values[0], out = [];
  for(var i=1;i<values.length;i++){ var obj={}; for(var j=0;j<head.length;j++){ obj[head[j]] = values[i][j]; } out.push(obj); }
  return out;
}
function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
