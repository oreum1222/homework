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
          { week: 2, file: 'data/hw-go3-2606-w2.json', label: '2주차에 한 숙제 검사 · N제 1~7회 + 이매진', date: '6/19(금)~6/20(토)', area: '선택+이매진', status: 'active' },
          { week: 3, file: 'data/hw-go3-2606-w3.json', label: '3주차에 한 숙제 검사 · N제 8~14회 + 이매진', date: '6/26(금)~6/27(토)', area: '선택+이매진', status: 'active' },
          { week: 4, file: 'data/hw-go3-2606-w4.json', label: '4주차에 한 숙제 검사 · N제 15~18회 + 이매진', date: '7/3(금)~7/4(토)', area: '선택+이매진', status: 'active' }
        ]
      },
      // (9월·10월 등 다음 달은 여기에 months 항목 추가)
    ]
  },

  // ═══ 한티 MEXX (여름 강의) — 교재 확정 후 weeks에 주차+data/hw-<id>-w<n>.json 채워 넣기 (비어 있으면 '준비 중') ═══
  {
    id: 'hanti-jong-m3-hyeonbeop',
    name: '한티 MEXX 종합반 중3 현대문법',
    grade: '중3',
    period: '한티 MEXX 종합반',
    desc: '중3 현대문법 — 3주 과정(품사 · 문장성분 · 형태소와 단어).',
    weeks: [
      { week: 1, file: 'data/hw-hanti-jong-m3-hyeonbeop-w1.json', label: '1주차 · 품사', area: '품사', status: 'active' },
      { week: 2, file: 'data/hw-hanti-jong-m3-hyeonbeop-w2.json', label: '2주차 · 문장성분', area: '문장성분', status: 'active' },
      { week: 3, file: 'data/hw-hanti-jong-m3-hyeonbeop-w3.json', label: '3주차 · 형태소와 단어', area: '형태소와 단어', status: 'active' }
    ]
  },
  {
    id: 'hanti-jong-h1-gojeonbeop',
    name: '한티 MEXX 종합반 고1 고전문법',
    grade: '고1',
    period: '한티 MEXX 종합반',
    desc: '고1 고전문법 — 3주 과정(주당 약 35문항). 틀린 문항을 교재 번호 그대로 체크하세요.',
    weeks: [
      { week: 1, file: 'data/hw-hanti-jong-h1-gojeonbeop-w1.json', label: '1주차 · 1~35', area: '고전 문법', status: 'active' },
      { week: 2, file: 'data/hw-hanti-jong-h1-gojeonbeop-w2.json', label: '2주차 · 36~70', area: '고전 문법', status: 'active' },
      { week: 3, file: 'data/hw-hanti-jong-h1-gojeonbeop-w3.json', label: '3주차 · 71~92 + 수능 1~12', area: '고전 문법', status: 'active' }
    ]
  },
  {
    id: 'hanti-dan-h1-gojeonmunhak',
    name: '한티 MEXX 단과 고1 고전 문학',
    grade: '고1',
    period: '한티 MEXX 단과',
    desc: '고1 고전 문학 — 5주 과정. 작품(세트)별로 틀린 문항을 교재 번호 그대로 체크하세요.',
    weeks: [
      { week: 1, file: 'data/hw-hanti-dan-h1-gojeonmunhak-w1.json', label: '1주차 · 고대가요', area: '고대가요', status: 'active' },
      { week: 2, file: 'data/hw-hanti-dan-h1-gojeonmunhak-w2.json', label: '2주차 · 향가', area: '향가', status: 'active' },
      { week: 3, file: 'data/hw-hanti-dan-h1-gojeonmunhak-w3.json', label: '3주차 · 고려가요와 한시', area: '고려가요·한시', status: 'active' },
      { week: 4, file: 'data/hw-hanti-dan-h1-gojeonmunhak-w4.json', label: '4주차 · 시조와 가사', area: '시조·가사', status: 'active' },
      { week: 5, file: 'data/hw-hanti-dan-h1-gojeonmunhak-w5.json', label: '5주차 · 시조', area: '시조', status: 'active' }
    ]
  },
  {
    id: 'hanti-dan-h1-gojeonbeop',
    name: '한티 MEXX 단과 고1 고전 문법',
    grade: '고1',
    period: '한티 MEXX 단과',
    desc: '고1 고전 문법 — 4주 과정(주당 26문항). 틀린 문항을 교재 번호 그대로 체크하세요.',
    weeks: [
      { week: 1, file: 'data/hw-hanti-dan-h1-gojeonbeop-w1.json', label: '1주차 · 1~26', area: '고전 문법', status: 'active' },
      { week: 2, file: 'data/hw-hanti-dan-h1-gojeonbeop-w2.json', label: '2주차 · 27~52', area: '고전 문법', status: 'active' },
      { week: 3, file: 'data/hw-hanti-dan-h1-gojeonbeop-w3.json', label: '3주차 · 53~78', area: '고전 문법', status: 'active' },
      { week: 4, file: 'data/hw-hanti-dan-h1-gojeonbeop-w4.json', label: '4주차 · 79~92 + 수능 1~12', area: '고전 문법', status: 'active' }
    ]
  },
  {
    id: 'hanti-dan-h2-hwaeon',
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
