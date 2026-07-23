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

/* ▣ 학원 목록 — 학생은 [학원 선택 → 수업 선택 → 주차] 순으로 들어갑니다.
 *    각 강좌의 academy 값이 아래 id와 연결됩니다. (academy 없으면 'oreum'으로 간주) */
window.ACADEMY_LIST = [
  { id: 'oreum', name: '[오름] 국어학원', desc: '고3 정규반과 문법 강좌' },
  { id: 'hanti', name: '한티 MEXX 학원', desc: '종합반과 단과 강좌' }
];

window.COURSE_LIST = [

  // ═══ 고3 정규반 (월별 → 주차) ═══
  {
    id: 'go3-regular',
    name: '고3 정규반',
    academy: 'oreum',
    grade: '고3',
    desc: '정규반 월별 과제 — 월을 고르고 주차를 선택하세요.',
    period: '정규반',
    // roster: ['학생1','학생2'],   // (선택) 수강생 명단 → 미제출자 자동 체크
    months: [
      {
        key: '2026-06', month: '6월', status: 'active', desc: '6월 보충 — 수수활 + 이감 선택과목 N제',
        weeks: [
          { week: 1, file: 'data/hw-go3-2606-susu.json', label: '1주차에 한 숙제 검사 · 수수활 보충', date: '6/12(금)~6/13(토)', area: '수수활', status: 'active' },
          { week: 2, file: 'data/hw-go3-2606-w2.json', label: '2주차에 한 숙제 검사 · N제 1~7회 + 이매진', date: '6/19(금)~6/20(토)', area: '선택+이매진', status: 'active' },
          { week: 3, file: 'data/hw-go3-2606-w3.json', label: '3주차에 한 숙제 검사 · N제 8~14회 + 이매진', date: '6/26(금)~6/27(토)', area: '선택+이매진', status: 'active' },
          { week: 4, file: 'data/hw-go3-2606-w4.json', label: '4주차에 한 숙제 검사 · N제 15~18회 + 이매진', date: '7/3(금)~7/4(토)', area: '선택+이매진', status: 'active' }
        ]
      },
      {
        key: '2026-07', month: '7월', status: 'active', desc: '7월 수능완성 + 수능 기출 — 매일 한 항목씩, 완료한 것을 체크하세요.',
        weeks: [
          { week: 1, file: 'data/hw-go3-2607-w3.json', label: '1주차에 한 숙제 검사 · 수능완성 독서 유형편 + 2018학년도 수능', date: '7/17(금)~7/18(토)', area: '독서 + 수능 기출', status: 'active' },
          { week: 2, file: 'data/hw-go3-2607-w4.json', label: '2주차에 한 숙제 검사 · 수능완성 문학 유형편과 선택 + 2019학년도 수능', date: '7/24(금)~7/25(토)', area: '문학, 선택과목 + 수능 기출', status: 'active' },
          { week: 3, file: 'data/hw-go3-2607-w5.json', label: '3주차에 한 숙제 검사 · 수능완성 실전편 1~3회와 선택 + 2020학년도 수능', date: '7/31(금)', area: '실전 모의고사, 선택과목 + 수능 기출', status: 'active' }
        ]
      },
      // (9월·10월 등 다음 달은 여기에 months 항목 추가)
    ]
  },

  // ═══ [오름] 국어 문법 반 — 주차 데이터는 교재 확정 후 채웁니다(지금은 '준비 중'으로 표시) ═══
  {
    id: 'oreum-hyeonbeop',
    academy: 'oreum',
    name: '[오름] 국어 현대문법',
    grade: '전체',
    period: '오름 문법',
    desc: '현대문법 — 품사, 문장성분, 형태소와 단어 등. 주차별 과제를 검사합니다.',
    weeks: []
  },
  {
    id: 'oreum-gojeonbeop',
    academy: 'oreum',
    name: '[오름] 국어 고전문법',
    grade: '전체',
    period: '오름 문법',
    desc: '고전문법 — 훈민정음, 표기법, 문법 요소 등. 주차별 과제를 검사합니다.',
    weeks: []
  },

  // ═══ 한티 MEXX (여름 강의) — 교재 확정 후 weeks에 주차+data/hw-<id>-w<n>.json 채워 넣기 (비어 있으면 '준비 중') ═══
  {
    id: 'hanti-jong-m3-hyeonbeop',
    academy: 'hanti',
    name: '한티 MEXX 종합반 중3 현대문법',
    grade: '중3',
    period: '한티 MEXX 종합반',
    hidden: true,   // 대시보드 조회/집계에서 숨김(현재 미운영). 다시 열려면 이 줄 삭제.
    desc: '중3 현대문법 — 3주 과정(품사 · 문장성분 · 형태소와 단어).',
    weeks: [
      { week: 1, file: 'data/hw-hanti-jong-m3-hyeonbeop-w1.json', label: '1주차 · 품사', area: '품사', status: 'active' },
      { week: 2, file: 'data/hw-hanti-jong-m3-hyeonbeop-w2.json', label: '2주차 · 문장성분', area: '문장성분', status: 'active' },
      { week: 3, file: 'data/hw-hanti-jong-m3-hyeonbeop-w3.json', label: '3주차 · 형태소와 단어', area: '형태소와 단어', status: 'active' }
    ]
  },
  {
    id: 'hanti-jong-h1-gojeonbeop',
    academy: 'hanti',
    name: '한티 MEXX 종합반 고1 고전문법',
    grade: '고1',
    period: '한티 MEXX 종합반',
    hidden: true,   // 대시보드 조회/집계에서 숨김(현재 미운영). 다시 열려면 이 줄 삭제.
    desc: '고1 고전문법 — 3주 과정(주당 약 35문항). 틀린 문항을 교재 번호 그대로 체크하세요.',
    weeks: [
      { week: 1, file: 'data/hw-hanti-jong-h1-gojeonbeop-w1.json', label: '1주차 · 1~35', area: '고전 문법', status: 'active' },
      { week: 2, file: 'data/hw-hanti-jong-h1-gojeonbeop-w2.json', label: '2주차 · 36~70', area: '고전 문법', status: 'active' },
      { week: 3, file: 'data/hw-hanti-jong-h1-gojeonbeop-w3.json', label: '3주차 · 71~92 + 수능 1~12', area: '고전 문법', status: 'active' }
    ]
  },
  // 고1 단과 = '고전 영역' 한 강좌. 주차(1~5) 선택 → 그 주차 안에서 고전 문학(위) 체크 후 스크롤하면 고전 문법(아래) 체크.
  {
    id: 'hanti-dan-h1-gojeon',
    academy: 'hanti',
    name: '한티 MEXX 단과 고1 고전 영역',
    grade: '고1',
    period: '한티 MEXX 단과',
    desc: '고1 고전 영역 — 주차 안에서 고전 문학 먼저, 스크롤 내려 고전 문법을 체크하세요.',
    weeks: [
      { week: 1, file: 'data/hw-hanti-dan-h1-gojeon-w1.json', label: '1주차 · 고대가요 (고전 문학)', area: '고전 문학', status: 'active' },
      { week: 2, file: 'data/hw-hanti-dan-h1-gojeon-w2.json', label: '2주차 · 향가 + 고전 문법 1~26', area: '문학+문법', status: 'active' },
      { week: 3, file: 'data/hw-hanti-dan-h1-gojeon-w3.json', label: '3주차 · 고려가요 + 고전 문법 27~52', area: '문학+문법', status: 'active' },
      { week: 4, file: 'data/hw-hanti-dan-h1-gojeon-w4.json', label: '4주차 · 시조와 가사 + 고전 문법 53~78', area: '문학+문법', status: 'active' },
      { week: 5, file: 'data/hw-hanti-dan-h1-gojeon-w5.json', label: '5주차 · 가사 + 고전 문법 79~92', area: '문학+문법', status: 'active' }
    ]
  },
  {
    id: 'hanti-dan-h2-hwaeon',
    academy: 'hanti',
    name: '한티 MEXX 단과 고2 화법과 언어',
    grade: '고2',
    period: '한티 MEXX 단과',
    desc: '고2 화법과 언어 — 언어(문법) 5주 과정(품사 · 문장성분 · 형태소와 단어 · 음운의 체계 · 음운의 변동).',
    weeks: [
      { week: 1, file: 'data/hw-hanti-dan-h2-hwaeon-w1.json', label: '1주차 · 품사', area: '품사', status: 'active' },
      { week: 2, file: 'data/hw-hanti-dan-h2-hwaeon-w2.json', label: '2주차 · 문장성분', area: '문장성분', status: 'active' },
      { week: 3, file: 'data/hw-hanti-dan-h2-hwaeon-w3.json', label: '3주차 · 형태소와 단어', area: '형태소와 단어', status: 'active' },
      { week: 4, file: 'data/hw-hanti-dan-h2-hwaeon-w4.json', label: '4주차 · 음운의 체계', area: '음운의 체계', status: 'active' },
      { week: 5, file: 'data/hw-hanti-dan-h2-hwaeon-w5.json', label: '5주차 · 음운의 변동', area: '음운의 변동', status: 'active' }
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
