# Listing Bot Blockmedia

블록미디어 상장 공지 자동화 봇 - 업비트/빗썸의 신규 상장 공지를 자동으로 감지하여 블록미디어 스타일의 기사를 생성하고 텔레그램으로 배포합니다.

## 기능

- 텔레그램 채널 모니터링: 업비트/빗썸 상장 공지 자동 감지
- 스마트 필터링: 공지 변경, 거래 대기, 에어드랍 등 제외
- 중복 방지: 동일 코인의 첫 공지만 처리
- 2단계 스크래핑 파이프라인:
  - 업비트: Playwright (SPA 대응)
  - 빗썸: Cheerio → Playwright 폴백
- Claude API 기사 생성: 블록미디어 스타일의 기사 자동 작성
- 텔레그램 배포: 기사 본문 + 보도자료 메시지 (이미지 포함)
- 채팅방별 on/off 제어

## 기술 스택

- TypeScript
- Grammy (Telegram Bot Framework)
- Playwright (동적 렌더링)
- Cheerio (정적 파싱)
- Better-sqlite3 (데이터베이스)
- Claude API (기사 생성)
- Pino (로깅)

## 요구사항

- Node.js >= 20.0.0
- npm 또는 yarn
- Telegram Bot Token
- Anthropic API Key

## 설치

### 1. 저장소 클론

```bash
git clone <repository-url>
cd listing_bot_blockmedia
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Playwright 브라우저 설치

```bash
npx playwright install chromium
```

### 4. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 실제 값으로 채웁니다:

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
# Telegram Bot Token (BotFather에서 발급)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Claude API Key (Anthropic Console에서 발급)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# 모니터링할 채팅방 ID (새우잡이어선 공지방 등)
LISTING_SOURCE_CHAT_ID=your_source_chat_id_here

# 데이터베이스 경로
DB_PATH=./data/db.sqlite

# 기본 활성화 상태 (0: off, 1: on)
DEFAULT_ENABLED=0

# 출력 모드 (broadcast: 모든 활성화된 채팅, source_only: 소스 채팅만)
OUTPUT_MODE=broadcast

# 로그 레벨
LOG_LEVEL=info
```

### 5. 이미지 파일 준비

`assets` 폴더에 다음 이미지를 준비합니다:

- `upbit_listing_image.jpg`: 업비트 보도자료용 이미지
- `bithumb_listing_image.jpg`: 빗썸 보도자료용 이미지

### 6. 빌드

```bash
npm run build
```

## 실행

### 개발 모드 (핫 리로드)

```bash
npm run dev
```

### 프로덕션 모드

```bash
npm start
```

## 사용 방법

### 1. 봇을 채팅방에 초대

텔레그램에서 봇을 그룹 채팅이나 채널에 초대합니다.

### 2. 봇 활성화

채팅방에서 다음 명령어를 입력합니다 (관리자만 가능):

```
/on
```

봇이 활성화되면 해당 채팅방의 메시지를 모니터링하기 시작합니다.

### 3. 상장 공지 자동 처리

봇은 다음 조건을 만족하는 메시지를 자동으로 감지합니다:

- 업비트 신규 거래 지원 안내
- 빗썸 원화 마켓 추가

조건에 맞는 공지가 감지되면:
1. 공지 링크에서 전문 내용 스크래핑
2. Claude API로 블록미디어 스타일 기사 생성
3. 텔레그램으로 기사 + 보도자료 메시지 전송

### 4. 기타 명령어

- `/off`: 봇 비활성화 (관리자만)
- `/status`: 현재 상태 및 처리된 상장 목록 확인
- `/start`: 도움말 메시지

## 프로젝트 구조

```
listing_bot_blockmedia/
├── src/
│   ├── bot/
│   │   ├── commands.ts      # 텔레그램 명령어 핸들러
│   │   ├── filters.ts       # 메시지 필터링 로직
│   │   └── router.ts        # 메시지 라우팅 및 처리
│   ├── llm/
│   │   ├── claude.ts        # Claude API 클라이언트
│   │   ├── schema.ts        # 응답 스키마 검증
│   │   └── prompt_loader.ts # 프롬프트 로더
│   ├── scraper/
│   │   ├── notice_scraper.ts    # 공지 스크래핑 (2단계 파이프라인)
│   │   ├── browser_manager.ts  # Playwright 브라우저 관리
│   │   └── parsers.ts          # 티커 파싱
│   ├── publisher/
│   │   ├── press_release.ts        # 보도자료 메시지 생성
│   │   └── telegram_publisher.ts  # 텔레그램 전송
│   ├── storage/
│   │   └── db.ts            # SQLite 데이터베이스
│   ├── utils/
│   │   ├── logger.ts        # 로깅
│   │   ├── retry.ts         # 재시도 로직
│   │   └── text.ts          # 텍스트 유틸리티
│   └── index.ts             # 엔트리 포인트
├── prompts/
│   ├── upbit_listing_prompt.txt    # 업비트 기사 프롬프트
│   └── bithumb_listing_prompt.txt  # 빗썸 기사 프롬프트
├── assets/
│   ├── upbit_listing_image.jpg
│   └── bithumb_listing_image.jpg
├── .env                     # 환경 변수 (gitignore)
├── .env.example             # 환경 변수 템플릿
├── package.json
├── tsconfig.json
└── README.md
```

## 설정

### 출력 모드

`.env` 파일의 `OUTPUT_MODE`로 봇의 동작 방식을 변경할 수 있습니다:

- `broadcast` (기본값): 모든 활성화된 채팅방에 전송
- `source_only`: 소스 채팅방에만 전송
- `single`: 특정 채팅방에만 전송 (`OUTPUT_CHAT_ID` 필요)

### 재시도 설정

스크래핑, Claude API, 텔레그램 전송 실패 시 자동으로 재시도합니다. `.env`에서 설정 가능:

```env
MAX_SCRAPE_RETRIES=2
MAX_CLAUDE_RETRIES=2
MAX_TELEGRAM_RETRIES=2
```

### 로그 레벨

`.env`의 `LOG_LEVEL`로 로그 상세도를 조절:

- `trace`: 모든 로그 (매우 상세)
- `debug`: 디버깅 정보 포함
- `info`: 일반 정보 (권장)
- `warn`: 경고만
- `error`: 오류만
- `fatal`: 치명적 오류만

## 트러블슈팅

### Playwright 브라우저가 실행되지 않음

```bash
npx playwright install chromium
```

### 스크래핑이 실패함

- 로그 레벨을 `debug`로 변경하여 상세 로그 확인
- `data/debug/` 폴더에 저장된 HTML 파일 확인

### Claude API 호출 실패

- `ANTHROPIC_API_KEY`가 올바른지 확인
- API 사용량 및 크레딧 확인

### 텔레그램 메시지가 전송되지 않음

- 봇이 채팅방에 초대되어 있는지 확인
- `/on` 명령어로 봇이 활성화되어 있는지 확인
- 봇에 메시지 전송 권한이 있는지 확인

## 라이선스

MIT

## 개발자

블록미디어

## 참고

- [Grammy 문서](https://grammy.dev/)
- [Playwright 문서](https://playwright.dev/)
- [Claude API 문서](https://docs.anthropic.com/)
