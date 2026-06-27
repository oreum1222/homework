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
  if (params.action === 'markDone')     return handleMarkDone_(params);   // 강사 수동 완료(예외)처리
  return handleSubmit_(params);   // 기본: 학생 제출 누적
}
function doGet(e){
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'roster')    return json_(readRoster_());
  if (action === 'pending')   return json_(readPending_());
  if (action === 'list')      return json_(readAll_());
  if (action === 'sendlog')   return json_(readLog_((e&&e.parameter&&e.parameter.date)||''));
  if (action === 'overrides') return json_(readOverrides_());
  return json_({ ok:true, msg:'오름 숙제 진단 백엔드 정상 작동 중' });
}
// ── 수동 완료(예외)처리: 강사가 특정 (수업·주차·학생)을 완료로 표시 → 화면·자동발송 모두 완료 취급 ──
var OVERRIDE_SHEET = '수동완료';
var OVERRIDE_HEADERS = ['courseId','week','name','time','by'];
function overrideKey_(cid, wk, nm){ return String(cid)+'|'+String(wk)+'|'+normName_(nm); }
function readOverrides_(){
  try{
    var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OVERRIDE_SHEET);
    if(!sh) return [];
    var v=sh.getDataRange().getValues(); if(v.length<2) return [];
    var out=[];
    for(var i=1;i<v.length;i++){ if(String(v[i][0])==='') continue; out.push({courseId:String(v[i][0]), week:String(v[i][1]), name:String(v[i][2])}); }
    return out;
  }catch(e){ return []; }
}
function handleMarkDone_(params){
  try{
    var cid=String(params.courseId||''), wk=String(params.week||''), nm=String(params.name||''), on=String(params.on||'1')==='1';
    if(!cid||!wk||!nm) return json_({ok:false, error:'courseId/week/name 필요'});
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sh=ss.getSheetByName(OVERRIDE_SHEET);
    if(!sh){ sh=ss.insertSheet(OVERRIDE_SHEET); sh.appendRow(OVERRIDE_HEADERS); sh.setFrozenRows(1); }
    var v=sh.getDataRange().getValues(), key=overrideKey_(cid,wk,nm), found=-1;
    for(var i=1;i<v.length;i++){ if(overrideKey_(v[i][0],v[i][1],v[i][2])===key){ found=i; break; } }
    if(on){ if(found<0) sh.appendRow([cid,wk,nm,new Date(),params.by||'']); return json_({ok:true, on:true}); }
    if(found>=0) sh.deleteRow(found+1);
    return json_({ok:true, on:false});
  }catch(e){ return json_({ok:false, error:String(e)}); }
}
// 발송로그 조회(읽기 전용) — date='yyyy-MM-dd'(Asia/Seoul) 주면 그날 것만. 번호는 마스킹 저장됨.
function readLog_(dateStr){
  try{
    var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
    if(!sh) return [];
    var vals=sh.getDataRange().getValues(); if(vals.length<2) return [];
    var head=vals[0], out=[];
    for(var i=1;i<vals.length;i++){ var o={}; for(var j=0;j<head.length;j++) o[head[j]]=vals[i][j]; out.push(o); }
    if(dateStr){ out=out.filter(function(r){ var t=r[head[0]]; if(!(t instanceof Date)) return false;
      return Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd')===dateStr; }); }
    return out;
  }catch(e){ return []; }
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

    var type=String(params.type||'undone');
    var method=String(params.method||'');
    var text=(type==='forgot') ? forgotText_(name, due, method) : oathText_(name, due);
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
function forgotText_(name, due, method){
  return '[' + BRAND_NAME + '] 각서\n\n'
    + '나, ' + name + '은(는) 오늘 숙제 교재와 워크북을 가져오지 않았음을 솔직히 인정합니다.\n\n'
    + '교재·워크북이 없으면 숙제를 확인할 수 없고 수업 중 점검도 어려워, 결국 손해 보는 사람은 나라는 것도 알고 있습니다.\n\n'
    + '다음부터는 숙제 교재와 워크북을 빠짐없이 챙겨 오겠으며, 아래대로 반드시 재검사를 받겠습니다.\n\n'
    + '재검사 일자: ' + (due || '(미정)') + '\n'
    + '재검사 방법: ' + (method || '(미정)') + '\n\n'
    + '* 숙제가 정말 버겁다면 ' + TEACHER_NAME + '에게 꼭 연락주세요. 상황을 헤아려 적정한 양으로 줄여드립니다. (진심입니다)';
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

  // 예외(보류·결석) 처리된 최신 주차분은 대기함에서 제외
  var ovr={}; try{ readOverrides_().forEach(function(o){ if(String(o.week)===String(latest)) ovr[normName_(o.name)]=1; }); }catch(e){}
  var pending=[], undoneN=0, sumN=0;
  roster.forEach(function(p){
    var name=String(p.name||'').trim();
    if(!name || go3IsTest_(name)) return;                                   // 테스트·제외 계정
    if(ovr[normName_(name)]) return;                                        // 예외(보류·결석)
    var gp=digits_(p.guardianPhone||''), sp=digits_(p.studentPhone||'');   // 학부모/학생 번호
    var consent=String(p.consent||'').toUpperCase();
    if(!gp && !sp) return;
    if(consent==='N'||consent==='NO'||consent.indexOf('미동의')>=0||consent.indexOf('거부')>=0) return;
    var sub=byName[normName_(name)];
    var doneLabel = sub ? String(sub['완수상태']||'') : '';
    // 과제 해결 정도(%) — 분수(0~1) 저장분은 ×100, 없으면 완수상태 라벨 환산
    var sStr = sub ? String(sub['과제해결정도']||'').replace('%','').replace(/\s/g,'') : '';
    var solveRate=null;
    if(sStr!=='' && !isNaN(parseFloat(sStr))){ solveRate=parseFloat(sStr); if(solveRate<=1) solveRate*=100; }
    else if(DONE_MAP[doneLabel]!=null) solveRate=DONE_MAP[doneLabel];
    var rate = sub ? String(sub['정답률']||'') : '';
    var doneTxt = (solveRate==null)?'-':(Math.round(solveRate)+'%');
    var rateTxt = rate===''? '-' : (String(rate).indexOf('%')>=0?rate:rate+'%');

    // 완수 판정: 과제 해결 71%↑ 또는 '전부 끝냄/대부분' → 완수자(독려 제외)
    var completed = sub && ((solveRate!=null && solveRate>=71) || doneLabel.indexOf('전부')>=0 || doneLabel.indexOf('대부분')>=0);
    // 미완 독려 → 미제출이거나 완수 못 한 학생만, 학생에게(없으면 학부모)
    if(!completed){
      var toU = sp || gp;
      if(toU){
        var t = (!sub)
          ? '['+BRAND_NAME+'] '+name+' 학생, 이번 '+weekLabel+' 과제 제출 기록이 아직 없습니다. 약속한 기한까지 꼭 마무리 부탁드립니다. ('+TEACHER_NAME+')'
          : '['+BRAND_NAME+'] '+name+' 학생, 이번 '+weekLabel+' 과제 해결 정도가 '+doneTxt+'입니다. 약속한 기한까지 꼭 마무리합시다. ('+TEACHER_NAME+')';
        pending.push([new Date(),'undone',name,toU,p.courseId||'',weekLabel,t,'대기']); undoneN++;
      }
    }
    // 주간 요약 → 학부모 + 학생 둘 다
    if(sub){
      var t2='['+BRAND_NAME+'] '+name+' 학생 '+weekLabel+' 과제 결과 안내 — 평균 정답률 '+rateTxt+', 과제 해결 정도 '+doneTxt+'. 자세한 내용은 가정통신문을 확인해 주세요. ('+TEACHER_NAME+')';
      [gp,sp].forEach(function(ph){ if(ph) pending.push([new Date(),'summary',name,ph,p.courseId||'',weekLabel,t2,'대기']); });
      sumN++;
    }
  });

  // '발송대기' 시트: 머리글만 남기고 비운 뒤 이번 주 대기 적재(이번 주 큐)
  var sh=getSheet_(PENDING_SHEET, PENDING_HEADERS);
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,PENDING_HEADERS.length).clearContent();
  if(pending.length) sh.getRange(2,1,pending.length,pending[0].length).setValues(pending);

  // 교사 메일 알림(현황 안내용 — 발송은 토요일 자동발송/문자 발송 탭에서)
  try{
    var to=Session.getEffectiveUser().getEmail();
    if(to){
      MailApp.sendEmail(to,
        '[숙제시스템] '+weekLabel+' 과제 현황 — 미완 '+undoneN+'명 / 제출 '+sumN+'명',
        weekLabel+' 과제 현황 알림입니다.\n'
        +'· 미완(미제출·미완수): '+undoneN+'명\n· 제출: '+sumN+'명\n\n'
        +'고3 정규반은 토요일 자동발송(검수메일 13시 → 학생 15시 → 학부모 16시)으로 안내됩니다.\n'
        +'그 외·수시 발송은 대시보드 → 문자 발송 탭에서 진행하세요.\n');
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

// ════════════════════════ 고3 정규반 전용 주간 자동발송 (검수 게이트) ════════════════════════
// 운영: 매주 토요일. ① 13시 검수메일(go3MailDigest) → ② 15시 학생(go3SendStudents) → ③ 16시 학부모(go3SendParents)
//        [트리거 3개 주 단위 등록]. 멈추려면 구글시트 「발송제어」 탭 B1칸에 Y → 그 주 학생·학부모 모두 발송 보류(발송 후 자동 비움).
// 분류 우선순위: 반복 > 미제출 > 미완성(과제 해결 71% 미만). 한 학생당 1통. 71% 이상은 발송 안 함.
// 발송 정책(2026-06-13~): 미제출 → 학생+학부모 / 미완성 → 학부모만(학생 미발송, 문자비 절감). 반복(현재 OFF) → 학생+학부모.
var GO3_COURSE = 'go3-regular';
var GO3_KIHAN  = '오늘 밤 11시';
// ★ 반복 발송 토글: false면 '반복'으로 분류 안 함 → 그 학생은 이번 주 실제 상태(미제출/미완성)로 처리·발송.
//   (반복 집계 점검 동안 임시 OFF. 다시 켜려면 true)
var GO3_SEND_REPEAT = false;
// 검수메일 받을 주소(비우면 스크립트 소유자 본인 지메일). 다른 주소로 받으려면 Script Property GO3_NOTIFY_EMAIL 설정.
function go3NotifyEmail_(){
  var p=PropertiesService.getScriptProperties().getProperty('GO3_NOTIFY_EMAIL');
  if(p && p.indexOf('@')>0) return p.trim();
  try{ return Session.getEffectiveUser().getEmail(); }catch(e){ return Session.getActiveUser().getEmail(); }
}
function go3Esc_(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// 발송 멈춤 스위치 — 「발송제어」 탭 B1칸 (Y/중지/보류/STOP 이면 보류)
function go3ControlSheet_(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(); if(!ss) return null;
  var sh=ss.getSheetByName('발송제어');
  if(!sh){ sh=ss.insertSheet('발송제어');
    sh.getRange('A1').setValue('발송보류(Y=중지)'); sh.getRange('B1').setValue('');
    sh.getRange('A2').setValue('설명'); sh.getRange('B2').setValue('B1칸에 Y 입력 시 이번 주 학생·학부모 문자 모두 발송 보류. 발송(또는 보류) 처리 후 자동으로 비워집니다.');
    sh.setColumnWidth(1,160); sh.setColumnWidth(2,520); }
  // 이번 주 제외 명단 칸 — D1 머리글, D2부터 이름 1명씩 (없으면 셋업)
  if(!String(sh.getRange('D1').getValue()||'').trim()){
    sh.getRange('D1').setValue('이번 주 제외 명단(이름)');
    sh.getRange('E1').setValue('D2 아래로 이름을 한 명씩 적으면, 그 학생은 이번 주 학생·학부모 문자에서 제외됩니다(전체 중지는 B1=Y). 발송 후 자동으로 비워집니다.');
    sh.setColumnWidth(4,170); sh.setColumnWidth(5,560);
  }
  return sh;
}
function go3Hold_(){
  try{ var sh=go3ControlSheet_(); if(!sh) return false;
    var v=String(sh.getRange('B1').getValue()||'').trim().toUpperCase();
    return v==='Y'||v==='YES'||v.indexOf('중지')>=0||v.indexOf('보류')>=0||v.indexOf('STOP')>=0;
  }catch(e){ return false; }
}
// 「발송제어」 D2:D 의 이름들 → 이번 주 개별 발송 제외 { 정규화이름:1 }
function go3SkipList_(){
  var out={};
  try{ var sh=go3ControlSheet_(); if(!sh) return out;
    var last=sh.getLastRow(); if(last<2) return out;
    sh.getRange(2,4,last-1,1).getValues().forEach(function(r){ var nm=String(r[0]||'').trim(); if(nm) out[normName_(nm)]=1; });
  }catch(e){}
  return out;
}
function go3ClearHold_(){ try{ var sh=go3ControlSheet_(); if(sh){ sh.getRange('B1').setValue(''); var last=sh.getLastRow(); if(last>=2) sh.getRange(2,4,last-1,1).clearContent(); } }catch(e){} }

// 테스트 계정(실험용 등) + 제외 명단(다른 반 학생 등)은 집계·발송에서 완전 제외
var GO3_EXCLUDE = ['심재영'];   // 다른 반 학생 등 — 추가하려면 정규화된 이름을 여기에
function go3IsTest_(name){ var n=String(normName_(name)||''); if(GO3_EXCLUDE.indexOf(n)>=0) return true; return n.indexOf('실험용')>=0 || n.indexOf('테스트')>=0 || n.toLowerCase()==='test'; }
function go3SolveOf_(r){
  var s=String(r['과제해결정도']||'').replace('%','').replace(/\s/g,'');
  if(s!=='' && !isNaN(parseFloat(s))){ var v=parseFloat(s); if(v<=1) v=v*100; return v; }  // 분수(0~1) 저장분은 퍼센트로 환산
  var dl=String(r['완수상태']||''); return (DONE_MAP[dl]!=null)?DONE_MAP[dl]:0;
}
function go3Classify_(){
  var subs=readAll_(), roster=readRoster_();
  var weekSet={};
  subs.forEach(function(r){ if(String(r.courseId)===GO3_COURSE && !go3IsTest_(r.name)){ var w=Number(r.week)||0; if(w) weekSet[w]=1; } });
  var weeks=Object.keys(weekSet).map(Number).sort(function(a,b){return b-a;});
  if(!weeks.length) return { week:0, list:[] };
  var latest=weeks[0], recent=weeks.slice(0,3);
  var ovr={};   // 강사 수동 완료(예외)처리 — 최신 주차분은 발송 제외
  readOverrides_().forEach(function(o){ if(String(o.courseId)===GO3_COURSE && String(o.week)===String(latest)) ovr[normName_(o.name)]=1; });
  var skip=go3SkipList_();   // 「발송제어」 D열 이번 주 제외 명단
  var byNW={}, firstW={};   // normName -> { week: bestSolveRate }, 그리고 첫 제출 주차
  subs.forEach(function(r){ if(String(r.courseId)!==GO3_COURSE || go3IsTest_(r.name)) return; var w=Number(r.week)||0; if(!w) return;
    var nn=normName_(r.name), sr=go3SolveOf_(r);
    if(!byNW[nn]) byNW[nn]={};
    if(byNW[nn][w]==null || sr>byNW[nn][w]) byNW[nn][w]=sr;
    if(firstW[nn]==null || w<firstW[nn]) firstW[nn]=w;
  });
  var list=[];
  roster.forEach(function(p){ if(String(p.courseId)!==GO3_COURSE || go3IsTest_(p.name)) return;
    var name=String(p.name||'').trim(); var gp=digits_(p.guardianPhone||''), sp=digits_(p.studentPhone||'');
    var consent=String(p.consent||'').toUpperCase();
    if(!name || (!gp&&!sp)) return;
    if(consent==='N'||consent==='NO'||consent.indexOf('미동의')>=0||consent.indexOf('거부')>=0) return;
    if(ovr[normName_(name)]) return;   // 수동 완료(예외)처리됨 → 발송 안 함
    if(skip[normName_(name)]) return;  // 「발송제어」 제외 명단(D열) → 이번 주 발송 안 함
    var rec=byNW[normName_(name)]||{};
    var minW=(firstW[normName_(name)]!=null)?firstW[normName_(name)]:Infinity;   // 첫 제출 이전(등록 전)은 미제출로 안 셈
    function badAt(w){ if(w<minW) return false; if(!(w in rec)) return true; return rec[w]<71; }
    var hasLatest=(latest in rec), latestSr=hasLatest?rec[latest]:null;
    var thisMissing=!hasLatest, thisIncomplete=hasLatest && latestSr<71;
    if(!(thisMissing||thisIncomplete)) return;   // 71% 이상 → 발송 안 함
    var badCount=0; recent.forEach(function(w){ if(badAt(w)) badCount++; });
    var consec = recent.length>=2 && badAt(recent[0]) && badAt(recent[1]);   // 2주 연속
    var cat = (GO3_SEND_REPEAT && (badCount>=2 || consec)) ? 'repeat' : (thisMissing?'missing':'incomplete');
    list.push({ name:name, gp:gp, sp:sp, cat:cat, rate:(latestSr!=null?Math.round(latestSr):0) });
  });
  return { week:latest, list:list };
}
function go3StudentMsg_(x){
  var n=x.name, rate=x.rate+'%';
  if(x.cat==='missing') return n+', 이번 주 고3 수능 정규반 과제 검사 제출 기록이 아직 없습니다.\n\n숙제를 안 한 거면 오늘 안으로 마무리하고,\n숙제를 했는데 입력을 안 한 거면 지금 바로 검사 응답하기 바랍니다.\n\n여러분들이 제발 이 지긋지긋한 입시를 올해 마무리하고, 내년엔 웃는 얼굴로 행복하게 지내길 바랍니다.\n\n[오름] 국어 가경T';
  if(x.cat==='incomplete') return n+', 이번 주 과제 완수율이 '+rate+'로 확인됐습니다.\n\n고3 수업에서 과제는 그냥 숙제가 아니라 하루하루 쌓여가는 나의 수능 점수입니다.\n미완 부분은 '+GO3_KIHAN+'까지 반드시 마무리하고 다시 확인받기 바랍니다.\n\n여러분들이 제발 이 지긋지긋한 입시를 올해 마무리하고, 내년엔 웃는 얼굴로 행복하게 지내길 바랍니다.\n\n[오름] 국어 가경T';
  return n+', 최근 과제 미제출/미완성이 반복되고 있습니다.\n\n지금은 국어 실력보다, 해야 할 걸 제때 끝내지 않는 흐름이 더 문제입니다.\n고3이 이 패턴으로 가면 수업을 들어도 실전 감각이 전혀 쌓이지 않고, 수능날의 점수로 드러날 것입니다.\n\n여러분들이 제발 이 지긋지긋한 입시를 올해 마무리하고, 내년엔 웃는 얼굴로 행복하게 지내길 바랍니다.\n\n[오름] 국어 가경T';
}
function go3ParentMsg_(x){
  var n=x.name, rate=x.rate+'%';
  if(x.cat==='missing') return '[오름] 국어\n\n안녕하세요, '+n+' 학생 학부모님.\n이번 주 고3 수능 정규반 과제 검사에서 아직 '+n+' 학생의 제출 기록이 확인되지 않아 안내드립니다.\n\n숙제를 하지 않았거나, 했더라도 검사 입력을 안 한 상태일 수 있습니다.\n오늘 안으로 학생이 과제 검사에 응답할 수 있도록 한 번만 가정에서도 이야기해주시면 좋을 것 같습니다.\n\n학생들이 올해 꼭 입시를 끝내길 바라는 마음에서 가정에도 연락을 드립니다.\n\n- 가경T 드림';
  if(x.cat==='incomplete') return '[오름] 국어\n\n안녕하세요, '+n+' 학생 학부모님.\n이번 주 고3 수능 정규반 과제 확인 결과, '+n+' 학생의 과제 완수율은 '+rate+'입니다.\n\n고3 수업은 매주 과제 누적이 곧 수능 루틴으로 이어지기 때문에, 미완 부분은 '+GO3_KIHAN+'까지 마무리하도록 안내했습니다.\n가정에서도 한 번 이야기해주시면 좋을 것 같습니다.\n\n학생들이 올해 꼭 입시를 끝내길 바라는 마음에서 가정에도 연락을 드립니다.\n\n- 가경T 드림';
  return '[오름] 국어\n\n안녕하세요, '+n+' 학생 학부모님.\n최근 과제 검사에서 '+n+' 학생의 미완/미응답이 반복되어 안내드립니다.\n\n현재는 국어 실력 자체보다, 매주 해야 할 학습량이 제때 쌓이지 않는 흐름이 더 걱정되는 상황입니다.\n고3 수능반에서는 이 부분이 누적되면 실전 감각과 시간 운용에도 바로 영향을 줍니다.\n\n학생에게 반복적으로 잔소리를 하고 있으나 고쳐지지 않는다는 건 현재 학습 의지의 문제가 아닐까 염려됩니다.\n가정에서 "이렇게 불성실하게 학원을 다니면 보내주기 어렵다"라고 말씀하셔도 되니 아이가 마음을 다잡을 수 있게 한 마디 해주시면 감사하겠습니다.\n\n- 가경T 드림';
}
function go3Send_(messages, label){
  if(!messages.length) return (label||'')+' 대상 0명';
  var props=PropertiesService.getScriptProperties();
  var key=props.getProperty('SOLAPI_KEY'),secret=props.getProperty('SOLAPI_SECRET'),sender=props.getProperty('SOLAPI_SENDER');
  if(!(key&&secret&&sender)){ messages.forEach(function(m){ logSend_(m,'테스트','테스트','',''); }); return (label||'')+' 테스트모드 '+messages.length+'건(미발송)'; }
  var payload={messages:messages.map(function(m){ return {to:digits_(m.to),from:digits_(sender),text:m.text}; })};
  var res=UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail',{method:'post',contentType:'application/json',headers:{Authorization:solapiAuth_(key,secret)},payload:JSON.stringify(payload),muteHttpExceptions:true});
  var body={}; try{ body=JSON.parse(res.getContentText()||'{}'); }catch(_){}
  var failed={}; (body.failedMessageList||[]).forEach(function(f){ failed[digits_(f.to)]=f.statusMessage||'실패'; });
  var gid=(body.groupInfo&&body.groupInfo.groupId)||'', ok=0;
  messages.forEach(function(m){ var er=failed[digits_(m.to)]; logSend_(m,'문자',er?'실패':'발송',gid,er||''); if(!er)ok++; });
  return (label||'')+' 발송 '+ok+'/'+messages.length;
}
// ── 일회성 리마인드: 신지효·공두영, 수수활 과제검사 7/10 (전날 7/9 발송) ──
//   설치: go3SetupRemindJul9() 1회 실행 → 2026-07-09 14:00 자동 발송. 발송 후 트리거 자동 정리.
function go3RemindJul9(){
  var props=PropertiesService.getScriptProperties();
  try{ ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='go3RemindJul9') ScriptApp.deleteTrigger(t); }); }catch(e){}  // 일회성: 트리거 먼저 정리
  if(props.getProperty('GO3_REMIND_JUL9_SENT')==='1') return '이미 발송됨(중복 방지)';   // 중복 발송 방지
  var targets=['신지효','공두영'], roster=readRoster_(), msgs=[];
  targets.forEach(function(nm){
    var hit=null;
    roster.forEach(function(p){ if(String(p.courseId)===GO3_COURSE && normName_(p.name)===normName_(nm)) hit=p; });
    if(!hit) return;
    var sp=digits_(hit.studentPhone||''), gp=digits_(hit.guardianPhone||''), to=sp||gp;
    if(!to) return;
    var text=nm+' 학생, 내일(7/10) 수수활 과제 검사 예정입니다.\n\n내신 기간이라 미뤄 둔 수수활, 오늘까지 마무리해서 내일 꼭 검사받기 바랍니다.\n\n[오름] 국어 가경T';
    msgs.push({to:to,text:text,name:nm,scenario:'go3리마인드-수수활710',courseId:GO3_COURSE});
  });
  var r=go3Send_(msgs,'[리마인드7/10]');
  props.setProperty('GO3_REMIND_JUL9_SENT','1');
  return r;
}
// 주간 자동발송(go3MailDigest)이 돌 때 7/9 예약을 자동 등록 — 사용자는 clasp push만 하면 됨(편집기 실행 불필요)
function go3EnsureRemindJul9_(){
  try{
    if(PropertiesService.getScriptProperties().getProperty('GO3_REMIND_JUL9_SENT')==='1') return;
    var exists=false;
    ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='go3RemindJul9') exists=true; });
    var now=new Date(), target=new Date(2026,6,9,14,0,0);   // 2026-07-09 14:00 (월 인덱스 6=7월)
    if(!exists && now < target){ ScriptApp.newTrigger('go3RemindJul9').timeBased().at(target).create(); }
  }catch(e){}
}
// (선택) 즉시 예약하고 싶을 때 수동 실행
function go3SetupRemindJul9(){
  PropertiesService.getScriptProperties().deleteProperty('GO3_REMIND_JUL9_SENT');
  go3EnsureRemindJul9_();
  var msg='리마인드 예약 완료: 2026-07-09 14:00 → 신지효·공두영 (수수활 7/10 검사 안내)';
  Logger.log(msg); return msg;
}

// ① 토 13시 트리거 — 검수메일(발송 대상+문자 내용)을 가경T 지메일로. 발송 안 함.
function go3MailDigest(){
  go3EnsureRemindJul9_();   // 7/9 리마인드 예약 자동 등록(아직 미등록 시)
  var c=go3Classify_();
  var CAT={missing:'미제출',incomplete:'미완성',repeat:'반복'};
  var stu=c.list.filter(function(x){return x.cat!=='incomplete' && (x.sp||x.gp);}).length;   // 미완성은 학생 발송 제외
  var par=c.list.filter(function(x){return x.gp;}).length;
  var nm=0,ni=0,nr=0; c.list.forEach(function(x){ if(x.cat==='missing')nm++; else if(x.cat==='incomplete')ni++; else nr++; });
  var rows=c.list.map(function(x){
    return '<tr><td>'+go3Esc_(x.name)+'</td><td style="text-align:center">'+CAT[x.cat]+'</td><td style="text-align:center">'+x.rate+'%</td>'
      +'<td style="text-align:center">'+(x.cat==='incomplete'?'–':((x.sp||x.gp)?'O':'X'))+'</td><td style="text-align:center">'+(x.gp?'O':'X')+'</td></tr>';
  }).join('');
  var sRate=(c.list[0]?c.list[0].rate:0);
  function box(t,txt){ return '<div style="margin:6px 0;padding:10px 12px;background:#f6f7f9;border-radius:8px"><b>'+t+'</b>'
    +'<pre style="white-space:pre-wrap;font-family:inherit;margin:6px 0 0;font-size:13px">'+go3Esc_(txt)+'</pre></div>'; }
  var html='<div style="font-family:apple sd gothic neo,malgun gothic,sans-serif;max-width:680px;color:#1c2128">'
    +'<h2 style="margin:0 0 4px">고3 정규반 자동발송 검수</h2>'
    +'<div style="color:#566">'+c.week+'주차 · 대상 학생 '+stu+'명 / 학부모 '+par+'명 &nbsp;(미제출 '+nm+' · 미완성 '+ni+' · 반복 '+nr+')</div>'
    +'<div style="margin:12px 0;padding:12px;background:#fff6f6;border:1px solid #f0caca;border-radius:8px;font-size:14px">'
    +'<b>⏰ 발송 예정:</b> 이 검수메일과 같은 날(토) 학생 15:00 · 학부모 16:00<br>'
    +'<b>📩 발송 정책:</b> 미제출 → 학생+학부모 / <b>미완성 → 학부모만</b>(학생 미발송)<br>'
    +'<b>⛔ 전체 멈추려면:</b> 구글시트 <b>「발송제어」</b> 탭 <b>B1칸</b>에 <b>Y</b> 입력 (학생발송 15:00 전까지) → 학생·학부모 모두 발송 안 됨.<br>'
    +'<b>🙅 일부만 빼려면:</b> 같은 시트 <b>D2칸 아래</b>에 제외할 학생 <b>이름</b>을 적기 (15:00 전까지) → 그 학생만 학생·학부모 발송 제외. <u>회신 불필요</u>.'
    +'</div>'
    +(c.list.length
      ? '<table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="6">'
        +'<tr style="background:#eef1f4"><th>이름</th><th>분류</th><th>완수율</th><th>학생문자</th><th>학부모문자</th></tr>'+rows+'</table>'
      : '<div style="padding:14px;background:#eef7ef;border-radius:8px">이번 주 발송 대상이 없습니다.</div>')
    +'<h3 style="margin:18px 0 6px">발송될 문자 내용</h3>'
    +'<div style="color:#566;font-size:12px;margin-bottom:6px">실제 발송 시 <b>OOO</b>=학생 이름, 완수율=학생별 값으로 치환됩니다.</div>'
    +'<h4 style="margin:10px 0 2px">▣ 학생 (미제출만 발송 · 미완성은 학생에게 안 보냄)</h4>'
    +box('미제출',go3StudentMsg_({name:'OOO',cat:'missing',rate:0}))
    +'<h4 style="margin:10px 0 2px">▣ 학부모</h4>'
    +box('미제출',go3ParentMsg_({name:'OOO',cat:'missing',rate:0}))
    +box('미완성',go3ParentMsg_({name:'OOO',cat:'incomplete',rate:sRate}))
    +box('반복',go3ParentMsg_({name:'OOO',cat:'repeat',rate:0}))
    +'</div>';
  var subject=c.list.length ? ('[고3 자동발송 검수] '+c.week+'주차 · 학생 '+stu+' / 학부모 '+par+'명')
                            : '[고3 자동발송 검수] 발송 대상 0명';
  go3ClearHold_();   // 새 주차 검수 시작 → 지난 보류값 초기화
  MailApp.sendEmail({to:go3NotifyEmail_(), subject:subject, htmlBody:html});
  return '검수메일 발송 → '+go3NotifyEmail_()+' (대상 '+c.list.length+'명)';
}
// ② 토 15시 트리거 — 학생 발송 (학생 번호, 없으면 학부모)
function go3SendStudents(){
  if(go3Hold_()){ try{MailApp.sendEmail({to:go3NotifyEmail_(),subject:'[고3 자동발송] 보류됨(학생)',body:'「발송제어」 Y 설정으로 이번 주 학생 문자가 발송되지 않았습니다.'});}catch(e){} return '보류됨(학생) — 발송 안 함'; }
  var c=go3Classify_(), msgs=[];
  c.list.forEach(function(x){ if(x.cat==='incomplete') return;   // 미완성은 학생에게 발송 안 함(학부모만) — 문자비 절감
    var to=x.sp||x.gp; if(to) msgs.push({to:to,text:go3StudentMsg_(x),name:x.name,scenario:'go3학생-'+x.cat,courseId:GO3_COURSE}); });
  return go3Send_(msgs,'[학생]');
}
// ③ 토 16시 트리거 — 학부모 발송 + 보류값 자동 비움
function go3SendParents(){
  if(go3Hold_()){ try{MailApp.sendEmail({to:go3NotifyEmail_(),subject:'[고3 자동발송] 보류됨(학부모)',body:'「발송제어」 Y 설정으로 이번 주 학부모 문자가 발송되지 않았습니다.'});}catch(e){} go3ClearHold_(); return '보류됨(학부모) — 발송 안 함'; }
  var c=go3Classify_(), msgs=[];
  c.list.forEach(function(x){ if(x.gp) msgs.push({to:x.gp,text:go3ParentMsg_(x),name:x.name,scenario:'go3학부모-'+x.cat,courseId:GO3_COURSE}); });
  var r=go3Send_(msgs,'[학부모]'); go3ClearHold_(); return r;
}
// 발송 안 하고 분류만 확인(테스트용) — 편집기에서 실행 후 로그 보기
function go3Preview(){
  var c=go3Classify_();
  var s='[고3 정규반 자동발송 미리보기] 최신주차='+c.week+' · 대상 '+c.list.length+'명\n';
  c.list.forEach(function(x){ s+=' · '+x.name+' → '+({missing:'미제출',incomplete:'미완성',repeat:'반복'}[x.cat])+' ('+x.rate+'%)\n'; });
  Logger.log(s); return s;
}
// ★★ 트리거 일괄 등록 — 편집기에서 이 함수 1회 실행(트리거 관리 권한 '허용'). 매주 토요일 13/15/16시 자동.
function go3InstallTriggers(){
  var want=[['go3MailDigest',13],['go3SendStudents',15],['go3SendParents',16]];
  var names={}; want.forEach(function(w){ names[w[0]]=1; });
  ScriptApp.getProjectTriggers().forEach(function(t){ if(names[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t); });  // 중복 제거
  want.forEach(function(w){
    ScriptApp.newTrigger(w[0]).timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(w[1]).create();
  });
  var tz=Session.getScriptTimeZone();
  var out=ScriptApp.getProjectTriggers().filter(function(t){return names[t.getHandlerFunction()];})
    .map(function(t){return t.getHandlerFunction();});
  var msg='토요일 트리거 등록 완료 ('+tz+'): '+out.join(', ')+'\n  · go3MailDigest 13시(검수메일) → go3SendStudents 15시(학생) → go3SendParents 16시(학부모)';
  Logger.log(msg); return msg;
}
// 트리거 전체 해제(자동발송 끄기)
function go3RemoveTriggers(){
  var names={go3MailDigest:1,go3SendStudents:1,go3SendParents:1}, n=0;
  ScriptApp.getProjectTriggers().forEach(function(t){ if(names[t.getHandlerFunction()]){ ScriptApp.deleteTrigger(t); n++; } });
  Logger.log('삭제된 트리거 '+n+'개'); return '삭제된 트리거 '+n+'개';
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
