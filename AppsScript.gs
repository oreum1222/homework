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

// ════════════════════════ 라우팅 ════════════════════════
function doPost(e){
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action === 'sendMessages') return handleSend_(params);
  return handleSubmit_(params);   // 기본: 학생 제출 누적
}
function doGet(e){
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'roster') return json_(readRoster_());
  if (action === 'list')   return json_(readAll_());
  return json_({ ok:true, msg:'오름 숙제 진단 백엔드 정상 작동 중' });
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

// Solapi HMAC-SHA256 인증 헤더
function solapiAuth_(key, secret){
  var date = new Date().toISOString();
  var salt = Utilities.getUuid().replace(/-/g, '');
  var raw  = Utilities.computeHmacSha256Signature(date + salt, secret);
  var hex  = raw.map(function(b){ var v=(b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
  return 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + hex;
}
function digits_(s){ return String(s||'').replace(/[^0-9]/g, ''); }

function logSend_(m, channel, result, messageId, error){
  try{
    var sh = getSheet_(LOG_SHEET, LOG_HEADERS);
    sh.appendRow([ new Date(), m.courseId||'', m.name||'', maskPhone_(m.to), channel||'', m.scenario||'',
      String(m.text||'').slice(0,180), result||'', messageId||'', error||'' ]);
  }catch(_){}
}
function maskPhone_(p){ p=digits_(p); return p.length>=7 ? p.slice(0,3)+'****'+p.slice(-4) : p; }

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
