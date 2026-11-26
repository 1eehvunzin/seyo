---
name: journal
keywords: [일기, 다이어리, 하루 한 장, 오늘 하루, 감정, 기분, 감사, 독서, 책, 독서기록, 문장, 밑줄, 필사, 한줄평, 별점, 읽은, 영화, 드라마, 리뷰, 기록장, 사진 다이어리, 폴꾸]
---
# 기록장 스킬 (다이어리 · 독서기록 · 감상 기록)

## 하루 한 장 다이어리
- 날짜 `.stamp`(요일 + 큰 날짜), 날씨 고르기(맑음·구름·비·눈, 작은 SVG 아이콘), 기분 고르기(얼굴 SVG 5개 또는 색 점 5개).
- 오늘의 사진: `.polaroid` 하나(seyo.photo + 붙여넣기). 아래 짧은 한 줄 캡션.
- 오늘 한 줄 / 오늘의 일기(줄노트 `.paper-line` textarea), 감사한 일 3줄.
- 아래 작은 달력: 기록한 날은 그날 기분 색 점. 날짜를 누르면 그날 페이지로.
- 숫자 통계 카드는 맨 위에 두지 않는다. 필요하면 맨 아래 "이번 달 n일 기록" 한 줄.

## 독서기록장
- 책장 화면: 표지 카드 격자(표지 사진 없으면 책 제목을 세로 띠 색 카드로, 색은 책마다 다르게). 상태 탭: 읽고 싶은 / 읽는 중 / 다 읽음.
- 책 한 권 페이지: 표지(사진 또는 색), 제목·저자, 읽은 기간, 쪽수 진행 바(`.bar`), 별점 5개(반 개 가능하면 더 좋음), 한줄평.
- 문장 수집: 따옴표 큰 장식(“ ”)이 있는 카드, 쪽수, 내 생각 한 줄. 카드는 흰 바탕 + 얇은 선.
- 이번 달/올해 읽은 권수: 작은 책 등 아이콘이 쌓이는 그래픽(막대그래프보다 다꾸답다).

## 감상 기록 (영화·드라마·공연)
- 티켓 모양 카드(양쪽 반원 홈 + 점선 구분선), 날짜·장소·같이 본 사람, 별점, 명장면/명대사.

## 다이어리 뼈대 (출발점)
```html
<body>
<main class="app">
  <section class="card" style="padding:28px">
    <div class="between"><span class="stamp" id="date"><small>THU</small><b style="font-size:26px">26</b></span><div class="row" id="weather"></div></div>
    <h1 class="title" style="margin-top:14px">오늘의 기록</h1>
    <p class="label" style="margin-top:18px">오늘 기분</p><div class="row" id="moods"></div>
    <div class="row wrap" style="gap:20px;margin-top:18px;align-items:flex-start">
      <figure class="polaroid" style="width:200px;margin:0"><div class="ph" id="photo"></div><figcaption class="label" style="text-align:center;margin-top:8px" id="caption">오늘의 한 장</figcaption></figure>
      <div class="stack" style="flex:1;min-width:220px"><p class="label">오늘 한 줄</p><textarea id="line"></textarea></div>
    </div>
  </section>
  <section class="card"><p class="label">이번 달</p><div class="cal" id="month"></div></section>
</main>
```
기분 버튼은 얼굴 SVG를 `button.icon-btn`에, 고르면 `.on` 대신 배경 `var(--accent-soft)`. 달력 칸에는 그날 기분 색 점.

## 독서기록 뼈대 (출발점)
```html
<body class="theme-notion">
<main class="app">
  <div class="cover"></div>
  <header class="between" style="padding:0 4px;align-items:flex-end">
    <h1 class="title">독서기록장</h1><div class="tabs" id="tabs"><button class="on">읽는 중</button><button>다 읽음</button><button>읽고 싶은</button></div>
  </header>
  <!-- 큰 숫자 통계 카드 줄은 넣지 않는다. 필요하면 제목 아래 .label 한 줄 "올해 n권" -->
  <section class="grid" id="shelf" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></section><!-- 책 카드: 3:4 색 표지(제목 세로쓰기 또는 중앙) + 제목·별점 -->
  <section class="card" id="detail"><!-- 고른 책: 표지 · 제목/저자 · 기간 · 쪽수 .bar · 별점 · 한줄평 --></section>
  <section class="stack" id="quotes"></section><!-- 문장 카드: 큰 “ 장식, 문장, 쪽수, 내 생각 -->
</main>
```
입력 칸은 반드시 `.field`로 라벨과 묶는다 (`<label class="field"><span class="label">저자</span><input></label>`). 라벨 없는 입력칸을 줄줄이 늘어놓지 않는다. 책 추가는 작은 시트(카드)에서 제목·저자만 먼저, 나머지는 책 상세에서.
