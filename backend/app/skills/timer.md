---
name: timer
keywords: [타이머, 뽀모도로, 스톱워치, 집중, 공부 시간, 시간 재, 몇 분, 쉬는 시간, 카운트다운]
---
# 타이머 앱 스킬

## 시간 계산
- 실행 중이면 `S.running = { startedAt: Date.now(), baseMs: 0 }`를 저장한다. 남은/지난 시간은 매번 `Date.now() - startedAt + baseMs`로 계산한다.
- 이렇게 하면 페이지를 닫았다 열어도, 탭이 잠들어도 시간이 맞다. setInterval은 화면 갱신(250ms)에만 쓴다.
- 일시정지: `baseMs += Date.now() - startedAt; startedAt = null`.
- 끝나면 기록에 추가: `S.sessions.push({ at: Date.now(), ms })`. 오늘 총 공부 시간을 위에 보여 준다.

## 화면
- 가운데 큰 시간 `mm:ss` (font-variant-numeric: tabular-nums), 주변에 SVG 원형 진행.
- 버튼은 시작/일시정지 하나(상태에 따라 글자만 바뀜) + 다시 하기.
- 뽀모도로면 25분 집중 / 5분 쉬기 단계 표시, 오늘 몇 번 했는지 점으로.
- 끝나는 순간 화면 전체가 살짝 반짝이는 애니메이션 (소리는 쓰지 않는다).
- seyo.widget('오늘 공부', 'n분').
