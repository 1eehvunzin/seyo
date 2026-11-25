---
name: board
keywords: [팀, 조별, 조별과제, 팀플, 동아리, 업무, 프로젝트, 보드, 칸반, 협업, 역할, 담당, 담당자, 마감, 회의, 발표]
---
# 팀 보드 스킬 (조별과제 · 동아리 · 작은 팀)

지라처럼 복잡하게 말고, "누가 뭘 언제까지"가 한 화면에 보이게.

## 기본 구성
- 맨 위: 프로젝트 이름, 최종 마감 D-day, 전체 진행률(완료/전체, 얇은 `.bar`).
- 사람별 칸(또는 할 일·하는 중·끝 3칸 칸반, 요청에 맞게): 이름 + 이름 첫 글자 동그라미(사람마다 다른 파스텔 색).
- 할 일 카드: 제목, 담당 동그라미, 마감(오늘까지/내일/날짜), 상태 점(할 일 회색, 하는 중 파랑, 끝 초록 체크, 밀림 빨강 "1일 밀림" 태그).
- 카드 이동: 누르면 상태 순환 또는 끌어서 옮기기(손가락·펜슬로도 되게 pointer 이벤트).
- 회의·공지: 위쪽 `.callout` 한 줄(다음 회의 날짜).

## 팀 분위기
- 칭찬 스티커: 끝난 카드에 ♡·👏 같은 작은 스티커를 붙일 수 있게(누가 붙였는지 이름).
- 업무가 한 사람에게 몰리면 위쪽에 부드러운 안내("○○님 할 일이 많아요").
- 기본은 깔끔하게(`theme-notion` 또는 seyo 기본). 사용자가 꾸며 달라고 하면 style 스킬을 따른다.

## 팀 보드 뼈대 (출발점)
```html
<body class="theme-notion">
<main class="app">
  <header class="stack" style="gap:6px"><h1 class="title" id="name">조별과제</h1>
    <div class="row"><span class="badge" id="dday">D-5</span><div class="bar" style="flex:1"><i id="progress" style="width:40%"></i></div><span class="label" id="count">4/10</span></div>
  </header>
  <div class="callout" id="notice">📌 다음 회의 · 금 7시</div>
  <section class="grid" id="lanes" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"></section><!-- 사람별(또는 상태별) 열: 이름 동그라미 + 카드들 -->
</main>
```
카드: `.card` 안에 제목, 마감(`.label`), 상태 점, 끝나면 흐리게 + 체크, 밀리면 `.badge` 빨강 "1일 밀림".
