# seyo 실서비스: 남은 일

웹은 실사용자를 받을 수 있는 상태예요 (https://app.sayitseyo.kr). 이 문서는 **아직 남은 일**만 모았어요.
이미 된 것은 맨 아래 "지금 구성"에 있어요.

## 남은 일

| # | 할 일 | 누가 | 왜 남았나 |
|---|---|---|---|
| 1 | Apple Services ID 설정 확인 | 직접 (Apple Developer) | 웹 Apple 로그인이 동작하려면 필요 |
| 2 | 웹 카카오·Apple 로그인 실제로 한 번 해 보기 | 직접 | 실제 계정 로그인은 사람이 해야 확인돼요 |
| 3 | 약관, 개인정보 처리방침, 만 14세 미만 | 직접 (결정·작성) | 로그인 화면 링크가 아직 자리표시 |
| 4 | 아이패드 앱 빌드 + 카카오 네이티브 로그인 | 함께 (빌드 서명은 직접) | 새 빌드가 있어야 동작·확인 가능 |
| 5 | 구독 결제 (App Store) | 직접 (계약·상품) → 연결은 코드 | 지금은 "구독은 곧 열려요" 안내만 |
| 6 | 푸시 알림 | 앱 빌드 후 | 기획(아래)만 정해 둠 |
| 7 | App Store 출시 후 링크 | 출시 후 | `APP_STORE_URL` |

### 1. Apple Services ID 설정 확인
Apple Developer → Identifiers → Services IDs → `web.seyo.kr` → Sign in with Apple → **Configure**
- Primary App ID: `app.seyo.kr` (Team `SX7F8T4Q76`)
- Domains: `app.sayitseyo.kr`
- Return URLs: `https://app.sayitseyo.kr/auth/apple`

### 2. 로그인 실제로 해 보기
https://app.sayitseyo.kr → 한 줄로 페이지 만들기 → "저장하고 시작하기" → 카카오 / Apple.
로그인 뒤 홈에 방금 만든 페이지가 있고, 새로고침해도 남아 있으면 끝이에요.
- 카카오: Redirect URI(`https://app.sayitseyo.kr/auth/kakao`)와 Client Secret은 등록·서버 반영 완료.
- 카카오 콘솔 경고 "회원 탈퇴 웹훅"은 선택이에요 (카카오에서 연결 끊은 사용자를 알려 줌).

### 3. 약관, 개인정보, 만 14세 미만 (결정 필요)
- 이용약관, 개인정보 처리방침 페이지를 만들어 주소를 주면 로그인·구독 화면 링크에 연결할게요 (`Sheets.tsx`의 `showTerms`).
- 처리방침에 적을 것: 로그인(카카오·Apple) 식별자와 닉네임, 페이지 내용, 사진(기기에서 줄여 페이지 안에 저장), AI 처리 위탁(OpenAI 호환 게이트웨이 PleumRouter 경유), DB 위치(Supabase, 호주 시드니).
- **만 14세 미만**: 학생 대상이라 가입이 생길 수 있어요. 법정대리인 동의를 받을지, 14세 이상만 받을지 정해야 해요.
- 계정 삭제는 앱 안에 있어요 (내 계정 → 계정 삭제).

### 4. 아이패드 앱
- 코드에 이미 있는 것: Apple 공식 로그인 버튼(`expo-apple-authentication`), 번들 ID `app.seyo.kr`, `usesAppleSignIn`, 로그인 유지(키체인), 사진 권한 문구.
- 남은 것: 카카오 네이티브 SDK (`@react-native-seoul/kakao-login`, 네이티브 앱 키 `31274cd5…95c0`, 카카오 콘솔 iOS 번들 ID 등록). 그 전까지 아이패드에는 카카오 버튼을 숨겨 뒀어요.
- 빌드: `npx eas-cli@latest build -p ios --profile development` (Apple 계정 로그인·서명은 직접).
- 개발용 로그인은 서버에서 꺼져 있어서, 새 빌드 전 아이패드 개발 클라이언트로는 로그인이 안 돼요.

### 5. 구독 결제 (seyo plus)
1. App Store Connect: 유료 앱 계약, 은행, 세금 정보.
2. 구독 그룹 + 상품 2개: 1개월 ₩4,900, 1년 ₩39,000 (앱 `Sheets.tsx`의 `PLANS`와 같게).
3. 그 뒤 코드: `expo-iap`로 구매 → `api.verifyPurchase()`(서버 `/billing/apple`은 준비됨), Railway에 `APPLE_APP_ID`, Apple Root CA, 서버 알림 URL `https://api-production-3eebbba7.up.railway.app/billing/apple/notifications`.
- 그 전까지 구독 버튼은 "구독은 곧 열려요" 안내만 띄워요. (무료 회원: 페이지 5개, AI 월 30회)

### 6. 푸시 알림 (기획만 정함)
1. 페이지가 시키는 알림: 페이지가 `seyo.notify(시간, 문구)`로 기기에서 예약. AI가 다 만든 뒤 "디데이 당일 아침에 알려드릴까요?"처럼 먼저 제안, 권한은 그때 요청.
2. 팀 페이지: 멘션, 내 일에 달린 댓글, 맡겨진 일, 마감 임박, 칭찬 스티커 (완료는 하루 한 번 요약).
3. 기록 리마인더: 하루 한 번 이하 (서버 `app/reminders.py`, 매시 실행 필요).

### 7. 출시 후
- `APP_STORE_URL`(Railway `api` 변수)을 실제 주소로. 초대 링크 페이지의 "App Store" 버튼이 여기로 가요.
- (선택) Universal Links: `apple-app-site-association` + `ios.associatedDomains`로 초대 링크가 앱으로 바로 열리게.

---

## 지금 구성 (된 것)

**배포 (Railway 프로젝트 `seyo`)**
- `web`: https://app.sayitseyo.kr — `cd frontend && railway up --service web` (단일 페이지 앱, `serve -s dist`)
- `api`: https://api-production-3eebbba7.up.railway.app — `cd backend && railway up --service api` (시작 시 마이그레이션)
- 도메인: 가비아 DNS `app` CNAME + `_railway-verify.app` TXT. `@`, `www`(Vercel 랜딩)는 그대로.
- 운영 모드: `ENV=prod`, `DEV_LOGIN=false`, `DEV_BILLING=false`, 무작위 `JWT_SECRET`.

**데이터**
- DB: Supabase Postgres(시드니), Session pooler `aws-1-ap-southeast-2.pooler.supabase.com:5432` (직접 주소는 IPv6 전용이라 Railway에서 안 붙어요).
- 로그인하면 페이지가 서버에 저장돼요. 로그인은 브라우저(웹)·키체인(아이패드)에 남아 새로고침해도 그대로예요. 함께 쓰는 페이지는 열려 있는 동안 10초마다 새로 받아요.

**로그인**
- 웹 카카오: REST API 키 `50d8…bdbe`로 코드 → 서버 교환(`/auth/kakao/code`, `KAKAO_REST_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_APP_ID=1666452`).
- 웹 Apple: Services ID `web.seyo.kr` → `/auth/apple`(nonce 확인). 서버는 `app.seyo.kr`(앱)과 `web.seyo.kr`(웹) 토큰 모두 받아요.
- 로그인 전 체험: 첫 페이지 만들기 2번 무료 + AI 5번 (기기당), IP당 하루 40번.

**AI**
- OpenAI 호환 게이트웨이 PleumRouter: `OPENAI_BASE_URL=https://apirouter.pleum.ai/v1`, 모델 `gpt-5.4-mini`(생성·수정 모두).
- 바이브 코딩: `backend/app/code.py`, 스킬 `backend/app/skills/*.md`, 디자인 키트 `frontend/src/lib/appkit.ts`(클래스 목록은 `core.md`와 맞춰야 해요).
- 1회 원가: 새 페이지 ≈ ₩20~25, 고치기 ≈ ₩5~20, 첨부 사진 1장 +₩2. 무료 월 30회(최악 ≈ ₩600/명), 구독 월 300회.
- 품질 평가: `backend/evals/run_evals.py` (스크린샷을 보고 사람이 채점, 유료 채점 모델 없음).

**가격**: 월 ₩4,900 / 연 ₩39,000 (결제 연결 전).
