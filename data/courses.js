/**
 * 수업(강좌) 레지스트리 — 방학 숙제 진단 시스템
 * ───────────────────────────────────────────────
 * 학생 화면(index.html)과 대시보드(dashboard.html)가 공통으로 읽습니다.
 *
 * ▣ 새 수업 추가:  COURSE_LIST 배열에 { id, name, ... weeks:[...] } 한 덩어리 추가
 * ▣ 새 주차 추가:  해당 수업의 weeks 배열에 한 줄 추가 + data/hw-<id>-w<n>.json 파일 생성
 *
 * status: 'active'(진행중) | 'tentative'(예정/준비중) | 'closed'(마감)
 *
 * roster: (선택) 수강생 이름 배열. 넣어두면 대시보드 '학생별 리포트'에서
 *         주차를 선택했을 때 '미제출자'를 자동으로 골라 독려 코멘트를 띄워줍니다.
 *         학생이 입력하는 이름과 정확히 일치해야 합니다.
 */

window.COURSE_LIST = [

  {
    id: 'sample',                       // 영문/숫자 식별자 (파일명·시트 키로 쓰임)
    name: '샘플 강좌 — 현대문학 집중',     // 화면 표시 이름
    grade: '고3',                        // 대상 학년
    desc: '예시용 강좌입니다. 실제 강좌를 추가하면 이 카드는 지우세요.',
    period: '2026 여름방학',             // 운영 기간(표시용)
    roster: ['홍길동','김영희','이준호','박서연'],  // (선택) 수강생 명단 → 미제출자 자동 체크
    weeks: [
      { week: 1, file: 'data/hw-sample-w1.json', label: '1주차 · 현대시', area: '현대시', status: 'active' },
      { week: 2, file: 'data/hw-sample-w2.json', label: '2주차 · 현대소설', area: '현대소설', status: 'active' },
      // { week: 3, file: 'data/hw-sample-w3.json', label: '3주차 · 갈래복합', area: '갈래복합', status: 'tentative' },
    ]
  },

  {
    id: 'summer-grammar',
    name: '현대문법',
    grade: '고등',
    desc: '2026 썸머스쿨 · 현대문법 — 주차별 문법 영역 총정리 과제.',
    period: '2026 썸머스쿨',
    // roster: ['홍길동','김영희'],   // (선택) 수강생 명단 → 미제출자 자동 체크
    weeks: [
      { week: 8, file: 'data/hw-summer-grammar-w8.json', label: '8주차 · 음운 변동', area: '음운 변동', status: 'active' },
    ]
  },

  // ┌─ 새 수업 추가 예시 (주석 해제해서 사용) ─────────────────────────
  // {
  //   id: 'dokseo',
  //   name: '독서 논리 특강',
  //   grade: '고3',
  //   desc: '인문·과학·기술·경제 지문의 정보 구조를 잡는 6주 과정.',
  //   period: '2026 여름방학',
  //   weeks: [
  //     { week: 1, file: 'data/hw-dokseo-w1.json', label: '1주차 · 인문', area: '인문', status: 'active' },
  //   ]
  // },
  // └────────────────────────────────────────────────────────────────

];
