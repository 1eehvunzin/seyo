---
name: fandom
keywords: [최애, 아이돌, 덕질, 생일, 생카, 생일카페, 포카, 포토카드, 탑로더, 콘서트, 팬미팅, 컴백, 앨범, 굿즈, 멤버, 팬, 오시, 직캠, 응원]
---
# 덕질 스킬 (최애 생일 · 포카 · 일정)

국내 10~20대 팬 문화의 말과 모양을 그대로 쓴다. 실제 아이돌 이름·사진·로고를 지어내지 않는다(사용자가 적은 것만).

## 최애 생일 캘린더
- 맨 위: 가장 가까운 생일 카드 "D-12 ♡ ○○ 생일" (멤버 컬러 배경, 하트·반짝이 SVG). 당일이면 "HAPPY ○○ DAY 🎂" 축하 화면(작은 컨페티).
- 달력 `.cal`: 생일인 날은 그 사람 컬러의 하트나 동그라미, 이름 짧게. 여러 명이면 작은 점 여러 개.
- 인물 등록: 이름, 생일, **멤버 컬러**(색 8개 중 고르기), 사진(seyo.photo, 원형 또는 포카 비율 3:4). 목록은 생일 순(다가오는 순).
- 생카 일정 메모: 날짜, 장소, 특전(컵홀더·포카 등) 체크.

## 포카 컬렉션
- 포카는 세로 3:4 카드. 탑로더 느낌 = 둥근 투명 틀(흰 테두리 + 위쪽 작은 반원 홈 + 은은한 광택 그라데이션).
- 격자 바인더 화면(3~4열), 가진 것/없는 것(흐리게 + "구해요" 태그), 중복, 교환 중 태그.
- 카드 누르면 크게 + 메모(어디서 구했는지, 가격).

## 컴백·콘서트 일정
- 다가오는 일정 타임라인(날짜 도장 `.stamp` + 일정 이름 + D-day 스티커). 지난 일정은 접어두기.
- 티켓팅 체크리스트(예매 시간, 좌석, 입금).

## 색과 장식
- 멤버 컬러를 강조색으로 쓰고 나머지는 연한 톤으로. 하트·별·반짝이·리본 SVG, `.sticker`로 "D-day", "♡".
- 기본 테마는 `theme-pastel`(사용자가 다른 분위기를 말하면 그걸 따른다).

## 최애 생일 캘린더 뼈대 (출발점)
```html
<body class="theme-pastel">
<main class="app">
  <section class="card" id="next" style="background:var(--accent-soft);text-align:center;padding:28px">
    <span class="sticker" style="position:absolute;top:-12px;right:18px">♡ D-12</span>
    <!-- 다음 생일: 원형 사진(없으면 이니셜) · "○○ 생일까지" · 큰 D-day · 날짜. 아무도 없으면 "최애를 등록해 주세요" + 등록 버튼 -->
  </section>
  <section class="card">
    <div class="between"><h2 id="month"></h2><div class="row"><button class="icon-btn" id="prev">‹</button><button class="icon-btn" id="nextM">›</button></div></div>
    <div class="cal" id="cal" style="margin-top:12px"></div><!-- 생일 칸: 멤버 컬러 하트 SVG + 이름 -->
  </section>
  <section class="stack" id="people"></section><!-- 다가오는 순 카드: 사진 · 이름 · 멤버 컬러 점 · D-day 배지 -->
</main>
```
등록 폼은 처음부터 펼쳐 두지 말고 "+ 최애 추가" 버튼 → 작은 카드(이름, 생일, 멤버 컬러 8개, 사진). 달력은 이번 달만, 칸 높이 작게(`.cal-cell{min-height:52px}`).
