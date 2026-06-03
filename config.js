/**
 * 오름 국어 · 방학 숙제 진단 시스템 — 공통 설정
 * ───────────────────────────────────────────────
 * ⚠️ 이 시스템은 모의고사 진단과 "별도 시트 / 별도 Apps Script"를 씁니다.
 *    아래 SCRIPT_URL 에는 숙제 전용으로 새로 배포한 웹앱 URL을 넣으세요.
 *    (AppsScript.gs 를 새 스프레드시트에 붙여넣고 '배포 → 웹앱'으로 받은 URL)
 *
 *  비밀번호를 바꾸려면 DASH_PASSWORD 값만 수정하세요.
 */

window.OREUM_HW_CONFIG = {

  // 숙제 전용 Google Apps Script 웹앱 URL (배포 후 붙여넣기)
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzzngO8LiHfxNenUF6ZQIsSxrKCwVXr6yHSoFlBJsuMYOAnl8Y63nWkUJ-TS3zoxzGtsA/exec",

  // 강사 대시보드 비밀번호 — 본인만 알기 (필요 시 수정)
  DASH_PASSWORD: "oreum2025",

  // 브랜드 표기 (학생 화면·리포트 푸터에 노출)
  BRAND: "김가경 국어 연구소",
  TEACHER: "가경T",

  // 헤더 로고 (선택) — 비워두면 텍스트만 표시. 같은 폴더에 logo.png 저장 후 사용
  //   ※ 보내주신 오른쪽(은은한 라인) 로고 이미지를 oreum-hwsys/logo.png 로 저장하세요.
  LOGO_URL: "logo.png"

};
