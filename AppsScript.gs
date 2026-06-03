/**
 * 오름 국어 · 방학 숙제 진단 시스템 — Google Apps Script 백엔드 (숙제 전용)
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️ 모의고사 시스템과 "완전히 별도"의 새 스프레드시트에 붙여넣으세요.
 *
 * [설치 방법]
 *  1. 새 Google 스프레드시트 생성 (예: "오름 숙제 진단")
 *  2. 확장 프로그램 → Apps Script → 이 코드 전체 붙여넣기
 *  3. 배포 → 새 배포 → 유형: 웹앱
 *       - 실행: 나
 *       - 액세스 권한: 모든 사용자
 *  4. 발급된 웹앱 URL을 config.js의 SCRIPT_URL에 붙여넣기
 *  5. 시트 내용/주차가 바뀌어도 재배포 불필요 (URL 그대로 사용)
 *
 * 학생 제출(POST) → '제출' 시트에 한 행씩 누적
 * 대시보드 조회(GET ?action=list) → 전체 행을 JSON 배열로 반환
 */

var SHEET_NAME = '제출';

// 시트 컬럼 순서 (index.html submitResult의 payload 키와 일치)
var HEADERS = [
  'timestamp','courseId','courseLabel','week','weekLabel','area',
  'name','school','grade',
  '원점수','만점','정답률','맞은개수','틀린개수','총문항',
  '틀린문항','핵심패턴','강점','학습진단','제출방식',
  'patternsJson','strengthsJson','areaStatJson','wrongDetailsJson','studyDiagJson','studyAnsJson'
];

function doPost(e){
  try{
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var sheet = getSheet_();
    var params = (e && e.parameter) ? e.parameter : {};
    var row = HEADERS.map(function(h){ return params[h] !== undefined ? params[h] : ''; });
    sheet.appendRow(row);
    lock.releaseLock();
    return json_({ ok:true });
  }catch(err){
    return json_({ ok:false, error:String(err) });
  }
}

function doGet(e){
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if(action === 'list'){
    return json_(readAll_());
  }
  return json_({ ok:true, msg:'오름 숙제 진단 백엔드 정상 작동 중' });
}

function getSheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if(!sheet){
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if(sheet.getLastRow() === 0){
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readAll_(){
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  var head = values[0];
  var out = [];
  for(var i=1; i<values.length; i++){
    var obj = {};
    for(var j=0; j<head.length; j++){
      obj[head[j]] = values[i][j];
    }
    out.push(obj);
  }
  return out;
}

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
