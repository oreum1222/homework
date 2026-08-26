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
  { id: 'hanti', name: 'MEXX 학원', desc: '종합반과 단과 강좌' }
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
      {
        key: '2026-08', month: '8월', status: 'active', desc: '8월 수능완성 실전편 마무리 + 수능 기출(2021~2023학년도) → 8/22부터 이매진 6호 매일 과제 · 상상 시즌4 실모.',
        weeks: [
          { week: 1, file: 'data/hw-go3-2608-w1.json', label: '1주차에 한 숙제 검사 · 수능완성 실전편 마무리(4·5회) + 2021학년도 수능', date: '8/7(금)~8/8(토)', area: '실전 모의고사 + 수능 기출', status: 'active' },
          { week: 2, file: 'data/hw-go3-2608-w2.json', label: '2주차에 한 숙제 검사 · 2022학년도 수능', date: '8/14(금)~8/15(토)', area: '수능 기출', status: 'active' },
          { week: 3, file: 'data/hw-go3-2608-w3.json', label: '3주차에 한 숙제 검사 · 2023학년도 수능(마지막) + 상상 시즌4-1회', date: '8/21(금)~8/22(토)', area: '수능 기출', status: 'active' },
          { week: 4, file: 'data/hw-go3-2608-w4.json', label: '4주차에 한 숙제 검사 · 이매진 6호 1주차 + 상상 시즌4-2회', date: '8/28(금)~8/29(토)', area: '이매진 6호', status: 'active' }
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
    desc: '현대문법 — 품사, 문장성분, 형태소와 단어. 틀린 문항을 교재 번호 그대로 체크하세요.',
    // 1~3주차 과제는 MEXX 단과 고2 화법과 언어 1~3주차와 동일(복사본)
    weeks: [
      { week: 1, file: 'data/hw-oreum-hyeonbeop-w1.json', label: '1주차 · 품사', area: '품사', status: 'active' },
      { week: 2, file: 'data/hw-oreum-hyeonbeop-w2.json', label: '2주차 · 문장성분', area: '문장성분', status: 'active' },
      { week: 3, file: 'data/hw-oreum-hyeonbeop-w3.json', label: '3주차 · 형태소와 단어', area: '형태소와 단어', status: 'active' },
      // 4주차 = MEXX 화법과 언어 4주차(음운의 체계) + 5주차(음운의 변동) 합본
      { week: 4, file: 'data/hw-oreum-hyeonbeop-w4.json', label: '4주차 · 음운의 체계와 변동', area: '음운', status: 'active' }
    ]
  },
  {
    id: 'oreum-gojeonbeop',
    academy: 'oreum',
    name: '[오름] 국어 고전문법',
    grade: '전체',
    period: '오름 문법',
    desc: '고전문법 — 훈민정음, 표기법, 문법 요소 등. 틀린 문항을 교재 번호 그대로 체크하세요.',
    // MEXX 고전문법과 '문법 교재 과제'만 동일(문학 제외). 4주 과정 = 교재 1~92 + 수능 기출 12
    weeks: [
      { week: 1, file: 'data/hw-oreum-gojeonbeop-w1.json', label: '1주차 · 1~26', area: '고전 문법', status: 'active' },
      { week: 2, file: 'data/hw-oreum-gojeonbeop-w2.json', label: '2주차 · 27~52', area: '고전 문법', status: 'active' },
      { week: 5, tag: '2주차 (2)', file: 'data/hw-oreum-gojeonbeop-w5.json', label: '교재 53~70 + 내신형 워크북 1~50', area: '고전 문법', status: 'active' },
      { week: 3, file: 'data/hw-oreum-gojeonbeop-w3.json', label: '3주차 · 53~78', area: '고전 문법', status: 'active' },
      { week: 4, file: 'data/hw-oreum-gojeonbeop-w4.json', label: '4주차 · 79~92 + 수능 기출', area: '고전 문법', status: 'active' }
    ]
  },


  // ═══ MEXX 2학기 단과 (고2) ═══
  {
    id: 'hanti-dan-h2-hwaeon2',
    academy: 'hanti',
    name: 'MEXX 단과 고2 화법과 언어',
    grade: '고2',
    period: 'MEXX 단과',
    desc: '고2 화법과 언어 — 언어(문법) 4주 과정(품사 · 형태소와 단어 · 음운의 정의와 체계 · 음운변동).',
    weeks: [
      { week: 1, file: 'data/hw-hanti-dan-h2-hwaeon2-w1.json', label: '1주차 · 국어의 품사', area: '품사', status: 'active' },
      { week: 2, file: 'data/hw-hanti-dan-h2-hwaeon2-w2.json', label: '2주차 · 형태소와 단어', area: '형태소와 단어', status: 'active' },
      { week: 3, file: 'data/hw-hanti-dan-h2-hwaeon2-w3.json', label: '3주차 · 음운의 정의와 체계', area: '음운의 체계', status: 'active' },
      { week: 4, file: 'data/hw-hanti-dan-h2-hwaeon2-w4.json', label: '4주차 · 음운변동', area: '음운의 변동', status: 'active' }
    ]
  },
  {
    id: 'hanti-dan-h2-suneung',
    academy: 'hanti',
    name: 'MEXX 단과 고2 수능 대비',
    grade: '고2',
    period: 'MEXX 단과',
    desc: '고2 수능 대비 — 우리들의 첫 수능 국어(문학·독서). 주차 과제는 준비 중입니다.',
    weeks: []
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
