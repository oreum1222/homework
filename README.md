# 오름 국어 · 방학 숙제 진단 시스템

[오름] 국어학원의 **방학 수업별 숙제 검사 + 약점/강점/학습특징 진단** 시스템.
모의고사 진단 시스템(`oreum-mocksys`)과 동일한 디자인·UX를 계승하되, **수업 → 주차(영역) → 오답**의 2단계 섹션 구조로 재편한 별도 시스템입니다.

## 구조

```
oreum-hwsys/
├── index.html          ← 학생용: 수업 선택 → 주차 선택 → 4단계 진단
├── dashboard.html      ← 강사 대시보드 (비밀번호: oreum2025)
├── config.js           ← SCRIPT_URL · 비밀번호 · 브랜드 설정
├── AppsScript.gs       ← Google Apps Script 백엔드 (숙제 전용 시트)
└── data/
    ├── courses.js          ← 수업·주차 레지스트리 (목록 관리)
    ├── hw-sample-w1.json   ← 샘플: 1주차 현대시
    └── hw-sample-w2.json   ← 샘플: 2주차 현대소설
```

## 학생 플로우

1. **수업 선택** — 수강 중인 강좌 카드 선택
2. **주차 선택** — 해당 수업의 주차(영역) 선택
3. **4단계 진단**
   - STEP 1 기본 정보 (이름·학교·학년)
   - STEP 2 오답 마킹 (문항 번호 그리드 클릭 — 모고와 동일 UX)
   - STEP 3 학습 진단 (푼 시간·방식·복습·집중도 설문)
   - STEP 4 진단 리포트 (정답률·강점·약점 패턴·학습 특징·틀린 문항 분석)
4. 결과는 **자동으로 학원 시트에 전송** → 강사 대시보드에 누적

## 강사 대시보드

- 비밀번호 게이트 (config.js의 `DASH_PASSWORD`)
- **제출 목록 탭**: 수업·주차·이름 필터, 요약 통계, 제출 테이블
- **학생별 개별 리포트 탭**: (수업×학생) 단위로
  - 주차별 정답률 막대그래프(추이)
  - 영역별 누적 오답 도넛
  - 주차별 기록 테이블
  - 강점 진단 / 통합 약점 진단 / 학습 상황·특징
  - **학생별 개별 코멘트(자동 초안)** — 아래 참고
  - 학생별·전체 PDF 저장

### 학생별 개별 코멘트 (조교용)

각 학생 카드 하단에, 그 학생의 **오답·정답률·학습 성향을 반영한 코멘트 초안**이 자동으로 뜹니다.
- **수정 가능한 텍스트 박스** → 한두 군데 손봐서 더 생생하게 만든 뒤
- **[복사]** 인쇄/메모 붙여넣기 · **[문자로 보내기]** 휴대폰 문자 앱 연동(`sms:`) · **[다른 표현으로]** 문장 자동 교체
- 톤: 친근한 존대(경어체). 완성도(우수/양호/노력 필요/미제출)에 따라 어조가 달라지고, 같은 학생도 ‘다른 표현으로’를 누를 때마다 문장이 바뀌어 **친구끼리 겹치지 않습니다.**
- 상단 **`코멘트: N주차`** 드롭다운으로 어느 주차 기준으로 쓸지 선택.
- 코멘트의 ‘약점 콕 집기’ 품질은 문항 JSON의 `type`(유형) 값에 좌우됩니다 — `type`을 구체적으로 적을수록(예: `"관형사형 전성어미"`) 코멘트가 더 정확하고 생생해집니다.

### 미제출자 자동 체크
`courses.js`의 수업에 `roster`(수강생 명단)를 넣고, 리포트 탭에서 **특정 주차를 선택**하면
그 주차 미제출 학생이 별도 패널에 뜨고 **독려 코멘트 초안**까지 제공됩니다.

## 배포

1. `AppsScript.gs`를 **새 스프레드시트**에 붙여넣고 웹앱으로 배포 → URL 복사
2. `config.js`의 `SCRIPT_URL`에 붙여넣기
3. 저장소를 GitHub에 업로드 → Settings → Pages → main / (root)
4. 접속: `https://<계정>.github.io/oreum-hwsys/`

> ⚠️ 모의고사 시스템과 **시트·Apps Script를 반드시 분리**하세요. (데이터 컬럼 구조가 다름)

---

## 새 수업 추가

`data/courses.js`의 `COURSE_LIST`에 한 덩어리 추가:

```js
{
  id: 'dokseo',                 // 영문 식별자 (파일명·시트 키)
  name: '독서 논리 특강',
  grade: '고3',
  desc: '인문·과학·기술 지문 6주 과정',
  period: '2026 여름방학',
  weeks: [
    { week: 1, file: 'data/hw-dokseo-w1.json', label: '1주차 · 인문', area: '인문', status: 'active' },
  ]
}
```

## 새 주차(숙제) 추가

1. 해당 수업 `weeks` 배열에 한 줄 추가
2. `data/hw-<수업id>-w<주차>.json` 파일 생성 (아래 스키마 참고)

### 주차 데이터 스키마

| 키 | 설명 |
|----|------|
| `weekMeta` | `{ id, label, area, date, desc }` — 주차 메타 |
| `sections[]` | 화면 분류용 문항 묶음. `{ key, title, range, questions[] }` |
| `questions[]` | `no`(고유 문항번호), `answer`, `points`(미지정 시 3점=3·그외 2), `three`(변별 표시), `wr`(오답률%), `area`, `type`(유형), `source`(출처), `coreElement`(핵심 요소), `weakness1/2`(약점), `remediation`(보완 방향), `parentNote`(학부모 코멘트, 학생 비노출) |
| `patternRules[]` | 약점 패턴 규칙. `trigger:{ questions[], minHits, severeAt }` 충족 시 발동. `fallback` 지원 |
| `strengthRules[]` | 강점 규칙. `trigger:{ questions[], maxWrong }` (해당 문항을 maxWrong 이하로 틀리면 강점 인정) |
| `studyCheck[]` | 학습 진단 설문. `{ num, tag, q, opts[] }` — `tag`는 `time/method/review/difficulty/focus` |
| `studyDiagnosticCodes` | 설문 결과 → 학습 특징 코드. `D_self/D_dep/D_norev/D_rush/D_slow/D_focus` |

> `no`는 **숙제 전체에서 고유**해야 합니다(1..N). `sections`는 표시용 그룹일 뿐, 채점·패턴 매칭은 전부 `no` 기준입니다.

## 시작 전 점검

- `config.js`의 `SCRIPT_URL`이 `PASTE_YOUR...` 상태면 제출이 동작하지 않습니다.
- 샘플 강좌(`id: 'sample'`)는 실제 운영 전에 `courses.js`에서 삭제하세요.
