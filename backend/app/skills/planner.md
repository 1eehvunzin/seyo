---
name: planner
keywords: [위클리, 먼슬리, 데일리, 플래너, 주간, 월간, 일간, 스터디, 공부 계획, 계획표, 시험기간, 시험, 다이어리 속지, 속지, 타임테이블, 시간표, 투두, 할 일]
---
# 플래너 속지 스킬 (위클리 · 먼슬리 · 스터디 플래너)

학생들이 굿노트에서 실제로 많이 쓰는 속지 구성이다. 요청한 종류의 뼈대를 그대로 따른다. **기본은 플레인·미니멀**(흰 바탕, 얇은 선, 검정 강조, 과목 색만 파스텔). 테이프·스티커·테마는 사용자가 꾸며 달라고 할 때만 style 스킬로.

요청에 '위클리/주간'이 있으면 반드시 아래 7일 위클리 뼈대로 만든다. 시험기간이면 그 위클리 안에 D-day 스티커와 과목 색 태그를 더한다(스터디 플래너로 바꾸지 않는다). '스터디 플래너/오늘 공부'만 있으면 스터디 플래너 구성.

## 위클리 (가장 많이 쓰는 속지)
- 맨 위: 주 제목("11월 4주차" 또는 기간 "11.23 – 11.29"), 이번 주 목표 1~3줄.
- 본문: `.week` 7칸(월~일). 각 `.day-col` = 요일+날짜(오늘 강조) → 체크 가능한 할 일 목록(칸 안에서 바로 추가, 엔터로 다음 줄) → 남는 공간은 줄노트.
- 아래: 이번 주 해빗 트래커(습관 2~4개 × 7일 동그라미) + 메모.
- 주 이동(◀ 이번 주 ▶), 데이터는 주차별로 저장(`weeks["2026-W48"]`).

## 먼슬리
- 큰 월 표시(숫자 크게 + 영문 월 작게, 예: "11 November"), `.cal` 달력.
- 날짜 칸을 누르면 그날 일정 입력. 칸 안에는 일정 1~2개를 작은 점·짧은 글씨로, 더 있으면 "+2".
- 옆이나 아래에 이달 목표, 중요한 날(D-day) 목록. 주말은 색을 다르게(일요일 `.sun`).

## 스터디 플래너 (시험기간)
- 맨 위: 날짜, D-day(시험 날짜 바꿀 수 있게), 오늘의 목표 한 줄, (선택) 오늘의 한 마디.
- 과목별 할 일: 과목 이름 색 태그 + 체크 목록. 과목 색은 4~6가지 파스텔로 고정.
- 타임테이블: 세로로 6시~24시, 10분 단위 칸을 눌러 색칠(과목 색). 오른쪽에 총 공부시간 자동 합계.
- 마무리: 오늘 공부 총 시간, 한 줄 회고.

## 공통
- 빈 상태도 속지처럼: 줄이나 점선 칸이 미리 그려져 있어 바로 쓰고 싶게. "할 일을 추가해 보세요" 문구만 덩그러니 두지 않는다.
- 체크하면 줄 긋기 + 살짝 흐리게, 하루 다 하면 날짜 옆에 작은 완료 표시.

## 위클리 뼈대 (출발점: 클래스와 배치는 유지하고 내용·기능만 요청대로)
```html
<body>
<main class="app">
  <header class="between">
    <div class="stack" style="gap:2px"><span class="label" id="range"></span><h1 class="title">이번 주</h1></div>
    <div class="row"><button class="icon-btn" id="prev" aria-label="지난주">‹</button><button class="icon-btn" id="next" aria-label="다음 주">›</button></div>
  </header>
  <section class="card">
    <p class="label">이번 주 목표</p><div class="list" id="goals"></div>
  </section>
  <section class="week" id="week"></section><!-- 7 × .day-col -->
  <section class="card"><p class="label">해빗 트래커</p><div id="habits"></div></section>
</main>
```
`.day-col` 하나: `<div class="day-col"><div class="between"><b>월</b><span class="stamp" style="min-width:auto;padding:2px 8px">23</span></div><div class="list">.item(.check + .text)…</div><input placeholder="+ 할 일" style="min-height:36px;border:0;background:transparent;padding:4px 0"></div>`. 오늘 칸은 `style="box-shadow:inset 0 0 0 2px var(--accent)"`.
`.week`의 열 수를 바꾸는 미디어쿼리를 직접 쓰지 않는다(키트가 좁은 화면에서 알아서 2열로 바꾼다. 1열로 길게 쌓지 않는다).
날짜·주차 계산: 연도는 `getFullYear()`, 월요일 시작, 키는 `"2026-W48"`처럼.
