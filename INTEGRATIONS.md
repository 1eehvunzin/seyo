# seyo 실서비스 연결 체크리스트

키나 계정 없이 돌아가는 부분은 다 만들어 두었어요. 이 문서는 **사람이 직접 발급하거나 결정해야 하는 것**만 모았어요.
값은 `backend/.env`에 넣어요 (`backend/.env.example` 참고). 앱 쪽 값은 `frontend/.env`에 `EXPO_PUBLIC_` 접두어로 넣어요.

## 한눈에 보기

| # | 항목 | 누가 | 넣을 곳 | 없으면 지금은 |
|---|---|---|---|---|
| 1 | Claude API 키 | 직접 발급 | `ANTHROPIC_API_KEY` | 키워드 규칙으로 페이지 생성, 수정 |
| 2 | 운영 DB (Postgres) | 직접 생성 | `DATABASE_URL` | 로컬 SQLite 파일 |
| 3 | 서버 서명 키 | 직접 생성 | `JWT_SECRET` | 개발용 기본값 (운영에서는 서버가 안 켜짐) |
| 4 | Apple 로그인 | Apple Developer | `APPLE_BUNDLE_ID` + 앱 작업 | `POST /auth/dev` 개발 로그인 |
| 5 | 카카오 로그인 | Kakao Developers | `KAKAO_APP_ID` + 앱 작업 | 개발 로그인 |
| 6 | 구독 결제 | App Store Connect | `APPLE_APP_ID`, `APPLE_ROOT_CERT_DIR` + 앱 작업 | `POST /billing/dev-plus` |
| 7 | 푸시 알림 | Expo / Apple | 앱 작업, (선택) `EXPO_ACCESS_TOKEN` | 알림 안 감 |
| 8 | 초대 링크 도메인 | 도메인 구매 | `PUBLIC_BASE_URL`, `APP_STORE_URL` | `http://localhost:8000/join/...` |
| 9 | 서버 배포 | 호스팅 선택 | `ENV=prod` 외 | 로컬 실행 |
| 10 | 약관, 개인정보, 만 14세 미만 | 법무 결정 | 앱 문구, 링크 | 자리표시 `[이용약관 본문]` |
| 11 | 가격, 무료 한도 | 기획 결정 | 앱 문구, `FREE_PAGES`, `FREE_AI_EDITS_PER_DAY` | `[₩00,000]`, 페이지 5개, 하루 20회 |

---

## 1. Claude API (말로 새 페이지, 말로 고치기)

- **발급**: [console.anthropic.com](https://console.anthropic.com) → API Keys. 결제 수단 등록이 필요해요.
- **넣기**: `ANTHROPIC_API_KEY=sk-ant-...`
- **설정값**: 모델 `claude-opus-5-5`, 생각 깊이 `CLAUDE_EFFORT=low`. 한 문장 요청이라 low로 시작했어요. 결과가 아쉬우면 `medium`으로 올려 보세요.
- **안전장치**: 정책상 거절되면 다른 모델로 한 번 더 시도하는 서버 측 fallback을 켜 뒀어요 (`server-side-fallback-2026-07-01` 베타). 키가 없거나 에러가 나면 자동으로 키워드 규칙으로 처리해서 앱이 멈추지 않아요.
- **비용**: Opus 5.5 기준 입력 100만 토큰당 $4, 출력 100만 토큰당 $20. 무료 사용자는 하루 `FREE_AI_EDITS_PER_DAY`회로 막혀 있어요.
- **코드**: `backend/app/ai.py`. 모델은 정해진 블록 7종 중 하나만 고르고(structured output), 화면 모양은 서버가 만들어요.
- **온보딩 첫 페이지는 AI를 쓰지 않아요.** 앱의 규칙표(`frontend/src/lib/page.ts`의 `ruleFor`)로 바로 만들어요.

## 2. 운영 DB

- **만들기**: Supabase, Neon, AWS RDS 중 아무 Postgres.
- **넣기**: `DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/seyo` 그리고 `pip install "psycopg[binary]"`
- **주의**: 지금은 서버가 켜질 때 테이블을 만들어요 (`create_all`). 출시 후 스키마를 바꾸기 전에 Alembic 마이그레이션을 붙여야 해요.

## 3. 서버 서명 키

- `python -c "import secrets; print(secrets.token_urlsafe(48))"` 결과를 `JWT_SECRET`에 넣어요.
- `ENV=prod`인데 이 값이 기본값이면 서버가 일부러 안 켜져요.

## 4. Apple 로그인

1. Apple Developer Program 가입 (연 $99).
2. Identifiers에서 App ID `com.seyo.app` 만들고 **Sign in with Apple** 체크.
3. 앱: `npx expo install expo-apple-authentication`, `app.json`의 `ios.usesAppleSignIn: true`.
4. 로그인 모달의 Apple 버튼을 **공식 `AppleAuthenticationButton`으로 교체**해야 심사를 통과해요. 지금 버튼은 디자인용이에요.
5. 받은 `identityToken`과 (첫 로그인 때만 오는) 이름을 `api.loginApple(token, name)`으로 보내요.
- 서버는 Apple 공개키로 토큰을 직접 검증해서, 따로 넣을 비밀 키는 없어요 (`APPLE_BUNDLE_ID`만 맞으면 돼요).

## 5. 카카오 로그인

1. [developers.kakao.com](https://developers.kakao.com)에서 앱 만들기 → 플랫폼에 iOS 번들 ID `com.seyo.app` 등록.
2. 카카오 로그인 켜기, 동의 항목에서 닉네임 선택.
3. 앱: `@react-native-seoul/kakao-login` 같은 네이티브 SDK (config plugin 필요, Expo Go 불가, 개발 빌드 필요). 네이티브 앱 키를 앱 설정에 넣어요.
4. 받은 access token을 `api.loginKakao(token)`으로 보내요.
- **넣기**: `KAKAO_APP_ID` (앱 설정의 앱 ID 숫자). 다른 앱에서 발급된 토큰을 막아요.
- **심사**: 카카오 로그인을 넣으면 App Store 규정상 Apple 로그인도 함께 있어야 해요. 이미 둘 다 있어요.

## 6. 구독 결제 (seyo plus)

1. App Store Connect: 유료 앱 계약, 은행, 세금 정보 등록.
2. 구독 그룹 만들고 상품 2개 (1년, 1개월). 가격을 정하면 앱의 `[₩00,000]`, `[n]% 아껴요` 자리를 채워요.
3. 앱: `expo-iap` 또는 `react-native-iap`로 구매 → `transaction.jwsRepresentation`을 `api.verifyPurchase()`로 보내요. "구매 복원"도 같은 경로를 써요.
4. 서버:
   - [Apple PKI](https://www.apple.com/certificateauthority/)에서 **Apple Root CA - G3** (`AppleRootCA-G3.cer`)를 받아 `backend/certs/`에 두고 `APPLE_ROOT_CERT_DIR=certs`.
   - `APPLE_APP_ID` = App Store Connect의 Apple ID 숫자.
   - App Store Connect → App Information → App Store Server Notifications V2 URL에 `https://<서버>/billing/apple/notifications` 등록 (갱신, 만료, 환불 반영).
- 운영에서는 `DEV_BILLING=false` (켜져 있으면 서버가 안 켜져요).

## 7. 푸시 알림 (밤 9시 알림, 다시 풀기 알림)

1. 앱: `npx expo install expo-notifications`, 권한 요청 후 `getExpoPushTokenAsync({ projectId })` → `api.registerPush(token)`.
2. EAS 프로젝트 만들기 (`npx eas-cli@latest init`), APNs 키는 `eas credentials`가 만들어 줘요.
3. 서버에서 매시 정각에 `python -m app.reminders` 실행 (cron, Render Cron Job, Cloud Scheduler). `REMINDER_HOUR_KST` 시에만 실제로 보내요.
- Expo에서 enhanced push security를 켰다면 `EXPO_ACCESS_TOKEN`을 넣어요.

## 8. 초대 링크

- 서버 도메인을 정하고 `PUBLIC_BASE_URL=https://api.seyo.app` 처럼 넣어요. 초대 링크는 `https://.../join/<토큰>`이 되고, 열면 앱을 띄우거나 App Store로 보내요.
- 앱이 출시되면 `APP_STORE_URL`을 실제 주소로 바꿔요.
- (선택) Universal Links: 링크가 Safari를 거치지 않고 바로 앱으로 열리게 하려면 도메인에 `apple-app-site-association`을 올리고 `app.json`의 `ios.associatedDomains`를 설정해요.

## 9. 서버 배포

- Render, Fly.io, Railway, Cloud Run 어디든 됩니다. 실행 명령: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- 필수 값: `ENV=prod`, `DEV_LOGIN=false`, `DEV_BILLING=false`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS` (웹을 안 쓰면 비워도 돼요).
- Python 3.10 이상.

## 10. 약관, 개인정보, 만 14세 미만 (결정 필요)

- 이용약관, 개인정보 처리방침 URL을 만들어 로그인 모달과 구독 모달의 링크에 연결해요. App Store 제출에도 필요해요.
- **학생 대상이라 만 14세 미만 가입이 생길 수 있어요.** 개인정보보호법상 만 14세 미만은 법정대리인 동의가 필요해요. 연령 확인 단계를 넣을지, 14세 이상만 받을지 정해야 해요.
- 계정 삭제는 App Store 필수 항목이라 서버에 `DELETE /me`를 만들어 뒀어요. 앱 계정 메뉴에 "계정 삭제"를 연결하면 돼요.
- Claude에 보내는 건 사용자가 입력한 요청 문장과 페이지 구조 요약뿐이에요. 처리방침에 "AI 처리 위탁 (Anthropic)"을 적어야 해요.

## 11. 기획 결정 (값만 정하면 돼요)

- 구독 가격, 연간 할인율 → 앱 `src/components/Sheets.tsx`의 `PLANS`
- 무료 페이지 수 → `FREE_PAGES` (서버), `FREE_PAGES` (앱 `src/app/generate.tsx`) 두 곳을 같이
- 무료 AI 횟수 → `FREE_AI_EDITS_PER_DAY`
- 홈의 샘플 페이지 (오답노트, 시간표, 영단어 챌린지)와 첫 페이지의 샘플 멤버 (지수, 민준)는 디자인 재현용이에요. 서버에 붙이면 지워요 (`samplePages`, `store.tsx`의 `login`).

---

## 앱 연결 (키를 받은 뒤 할 코드 작업)

API 클라이언트는 `frontend/src/lib/api.ts`에 다 만들어 뒀어요. 화면은 아직 기기 안 저장소(`store.tsx`)로 동작해요. 아래 순서로 바꾸면 돼요.

1. 로그인 모달 → `api.loginApple` / `api.loginKakao`, 토큰은 `expo-secure-store`에 저장.
2. `login()`이 하던 일 → `api.createPage(draft)` 후 `api.pages()`.
3. 페이지 수정 → `api.updatePage(id, patch, version)`. 409가 오면 `api.page(id)`로 다시 받아요. 함께 쓰는 페이지는 화면이 열려 있는 동안 10초마다 `api.page(id)`로 새로고침.
4. 말로 고치기, 새 페이지 → `api.edit`, `api.generate`. 402가 오면 구독 모달.
5. 초대 → `api.resetInvite`, `api.kick`, `api.leave`, 초대 링크 진입은 `api.join(token)`.
6. 홈 첫 진입 구독 모달 → `me.paywallSeen`이 false일 때만 띄우고 `api.paywallSeen()`.
