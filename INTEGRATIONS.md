# seyo 실서비스: 남은 일

웹은 실사용자를 받을 수 있는 상태예요 (https://app.sayitseyo.kr). 이 문서는 **아직 남은 일**만 모았어요.
이미 된 것은 맨 아래 "지금 구성"에 있어요.

## 남은 일

| # | 할 일 | 누가 | 왜 남았나 |
|---|---|---|---|
| 1 | Apple Services ID 설정 확인 + 웹 Apple 로그인 한 번 해 보기 | 직접 (Apple Developer) | 웹 Apple 로그인이 동작하려면 필요 (카카오 웹 로그인은 실제 계정으로 확인됨) |
| 2 | 약관·처리방침 검토 | 직접 | 초안을 서비스에 올려 둠 (/terms, /privacy). 법률 검토는 사람이 |
| 3 | 아이패드 앱 빌드 | 직접 (Apple 계정 서명) | 카카오·Apple 네이티브 로그인 코드는 다 들어감. 빌드가 있어야 기기에서 확인 |
| 4 | 구독 결제 (App Store) | 직접 (계약·상품) → 연결은 코드 | 지금은 "구독은 곧 열려요" 안내만 |
| 5 | 푸시 알림 | 앱 빌드 후 | 기획(아래)만 정해 둠 |
| 6 | App Store 출시 후 링크 | 출시 후 | `APP_STORE_URL` |

### 1. Apple Services ID 설정 확인
Apple Developer → Identifiers → Services IDs → `web.seyo.kr` → Sign in with Apple → **Configure**
- Primary App ID: `app.seyo.kr` (Team `SX7F8T4Q76`)
- Domains: `app.sayitseyo.kr`
- Return URLs: `https://app.sayitseyo.kr/auth/apple`

그 다음 https://app.sayitseyo.kr 에서 "Apple로 계속하기"를 한 번 눌러 보면 끝이에요.
(선택) 카카오 콘솔의 "회원 탈퇴 웹훅"과, 카카오 로그인 → 동의항목에서 **닉네임** 동의를 켜 두면 이름을 따로 묻지 않아요.

### 2. 약관·처리방침 검토
- 서비스 안에 올라가 있어요: https://app.sayitseyo.kr/terms , https://app.sayitseyo.kr/privacy (본문: `frontend/src/lib/legal.ts`).
- 만 14세 이상만 가입: 로그인 화면에서 "만 14세 이상이고 약관에 동의해요"를 체크해야 로그인 버튼이 동작해요.
- 실제 저장하는 정보, 국외 이전(Supabase 호주, Railway 미국, OpenAI 미국)을 기준으로 썼어요. 사업자 등록 후에는 상호·대표자·주소를 처리방침 10번에 더해 주세요. 법률 검토는 사람이 해 주세요.

### 3. 아이패드 앱 빌드
- 코드에 다 있는 것: Apple 공식 로그인 버튼, 카카오 네이티브 로그인(`@react-native-seoul/kakao-login`, 네이티브 앱 키, 카카오톡 앱 열기 스킴), 번들 ID `app.seyo.kr`, 로그인 유지(키체인), 사진 권한 문구.
- 카카오 콘솔: 네이티브 앱 키에 iOS 번들 ID `app.seyo.kr` 등록 완료.
- 빌드: `cd frontend && npx eas-cli@latest build -p ios --profile development` (Apple 계정 로그인·서명은 직접). Windows에서는 iOS 프로젝트를 만들 수 없어서 클라우드(EAS) 빌드로 해요.
- 서버의 개발용 로그인은 꺼져 있어서, 새 빌드 전 아이패드 개발 클라이언트로는 로그인이 안 돼요.

### 4. 구독 결제 (seyo plus)
1. App Store Connect: 유료 앱 계약, 은행, 세금 정보.
2. 구독 그룹 + 상품 2개: 1개월 ₩4,900, 1년 ₩39,000 (앱 `Sheets.tsx`의 `PLANS`와 같게).
3. 그 뒤 코드: `expo-iap`로 구매 → `api.verifyPurchase()`(서버 `/billing/apple`은 준비됨), Railway에 `APPLE_APP_ID`, Apple Root CA, 서버 알림 URL `https://api-production-3eebbba7.up.railway.app/billing/apple/notifications`.
- 그 전까지 구독 버튼은 "구독은 곧 열려요" 안내만 띄워요. (무료 회원: 페이지 5개, AI 월 30회)

### 5. 푸시 알림 (기획만 정함)
1. 페이지가 시키는 알림: 페이지가 `seyo.notify(시간, 문구)`로 기기에서 예약. AI가 다 만든 뒤 "디데이 당일 아침에 알려드릴까요?"처럼 먼저 제안, 권한은 그때 요청.
2. 팀 페이지: 멘션, 내 일에 달린 댓글, 맡겨진 일, 마감 임박, 칭찬 스티커 (완료는 하루 한 번 요약).
3. 기록 리마인더: 하루 한 번 이하 (서버 `app/reminders.py`, 매시 실행 필요).

### 6. 출시 후
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
- 로그인 전 체험: 첫 페이지 만들기 2번 무료 + AI 5번 (기기당), IP당 하루 40번 (IP 기록은 1년 뒤 삭제).
- 닉네임: 로그인이 이름을 안 주면 홈에서 한 번 묻고, "내 계정"에서 바꿀 수 있어요 (`PATCH /me`).
- 페이지 지우기: 페이지 위쪽 "지우기"(방장), "나가기"(함께 쓰는 사람). 홈에서 길게 눌러도 돼요.
- 계정 삭제: "내 계정 → 계정 삭제".

**AI**
- OpenAI 호환 게이트웨이 PleumRouter: `OPENAI_BASE_URL=https://apirouter.pleum.ai/v1`, 모델 `gpt-5.4-mini`(생성·수정 모두).
- 바이브 코딩: `backend/app/code.py`, 스킬 `backend/app/skills/*.md`, 디자인 키트 `frontend/src/lib/appkit.ts`(클래스 목록은 `core.md`와 맞춰야 해요).
- 1회 원가: 새 페이지 ≈ ₩20~25, 고치기 ≈ ₩5~20, 첨부 사진 1장 +₩2. 무료 월 30회(최악 ≈ ₩600/명), 구독 월 300회.
- 품질 평가: `backend/evals/run_evals.py` (스크린샷을 보고 사람이 채점, 유료 채점 모델 없음).

**가격**: 월 ₩4,900 / 연 ₩39,000 (결제 연결 전).
