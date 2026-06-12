/**
 * 수업(강좌) 레지스트리 — 방학 숙제 진단 시스템
 * ───────────────────────────────────────────────
 * 학생 화면(index.html)과 대시보드(dashboard.html)가 공통으로 읽습니다.
 *
 * ▣ 새 수업 추가:  COURSE_LIST 배열에 { id, name, ... weeks:[...] } 한 덩어리 추가
 * ▣ 새 주차 추가:  해당 수업의 weeks 배열에 한 줄 추가 + data/hw-<id>-w<n>.json 파일 생성
 *
 * ▣ 월별 수업(정규반):  weeks 대신 months:[{ key, month, status, weeks:[...] }] 사용
 *    → 화면 흐름: 반 선택 → 월 선택 → 주차 선택 → 진단
 *    → 각 주차 JSON의 weekMeta에 month:'9월' 을 넣으면 대시보드에 월이 함께 기록됩니다.
 *
 * status: 'active'(진행중) | 'tentative'(예정/준비중) | 'closed'(마감)
 *
 * roster: (선택) 수강생 이름 배열. 넣어두면 대시보드 '학생별 리포트'에서
 *         주차를 선택했을 때 '미제출자'를 자동으로 골라 독려 코멘트를 띄워줍니다.
 *         학생이 입력하는 이름과 정확히 일치해야 합니다.
 */

window.COURSE_LIST = [

  // ═══ 고3 정규반 (월별 → 주차) ═══
  {
    id: 'go3-regular',
    name: '고3 정규반',
    grade: '고3',
    desc: '정규반 월별 과제 — 월을 고르고 주차를 선택하세요.',
    period: '정규반',
    // roster: ['학생1','학생2'],   // (선택) 수강생 명단 → 미제출자 자동 체크
    months: [
      {
        key: '2026-06', month: '6월', status: 'active', desc: '6월 보충 — 수수활 + 이감 선택과목 N제',
        weeks: [
          { week: 1, file: 'data/hw-go3-2606-susu.json', label: '1주차에 한 숙제 검사 · 수수활 보충', date: '6/12(금)~6/13(토)', area: '수수활', status: 'active' },
          { week: 2, file: 'data/hw-go3-2606-w2.json', label: '2주차에 한 숙제 검사 · N제 1~7회', date: '6/19(금)~6/20(토)', area: '선택과목', status: 'active' },
          { week: 3, file: 'data/hw-go3-2606-w3.json', label: '3주차에 한 숙제 검사 · N제 8~14회', date: '6/26(금)~6/27(토)', area: '선택과목', status: 'active' },
          { week: 4, file: 'data/hw-go3-2606-w4.json', label: '4주차에 한 숙제 검사 · N제 15~18회', date: '7/3(금)~7/4(토)', area: '선택과목', status: 'active' },
          { week: 5, file: 'data/hw-go3-2606-imagine-w1.json', label: '이매진 4호 · 1주차 (Day 1~5)', date: '6/13~6/17', area: '이매진', status: 'active' },
          { week: 6, file: 'data/hw-go3-2606-imagine-w2.json', label: '이매진 4호 · 2주차 (Day 6~10)', date: '6/18~6/22', area: '이매진', status: 'active' },
          { week: 7, file: 'data/hw-go3-2606-imagine-w3.json', label: '이매진 4호 · 3주차 (Day 11~15)', date: '6/23~6/27', area: '이매진', status: 'active' },
          { week: 8, file: 'data/hw-go3-2606-imagine-w4.json', label: '이매진 4호 · 4주차 (Day 16~20)', date: '6/28~7/2', area: '이매진', status: 'active' }
        ]
      },
      {
        key: '2026-09', month: '9월', status: 'active', desc: '9월 정규반 과제',
        weeks: [
          { week: 1, file: 'data/hw-go3-2609-w1.json', label: '1주차', area: '', status: 'active' },
          // { week: 2, file: 'data/hw-go3-2609-w2.json', label: '2주차', area: '', status: 'tentative' },
        ]
      },
      // { key: '2026-10', month: '10월', status: 'tentative', weeks: [] },
    ]
  },

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
