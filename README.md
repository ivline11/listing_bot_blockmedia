# Listing Bot (Blockmedia)

업비트 / 빗썸 신규 상장 공지를 자동으로 감지하여 기사와 텔레그램 배포 메시지를 생성하는 봇입니다.

---

## 빠른 시작

```bash
cp .env.example .env   # .env 편집하여 키 설정
npm install
npm run dev            # 개발 모드 실행
```

---

## 환경 변수 (.env)

필수항목만 정리하면 아래입니다. 나머지는 `.env.example`에 주석으로 설명되어 있습니다.

| 변수 | 설명 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | BotFather에서 받은 봇 토큰 |
| `OPENAI_API_KEY` | OpenAI API 키 (`LLM_PROVIDER=gpt`일 때) |
| `ANTHROPIC_API_KEY` | Anthropic API 키 (`LLM_PROVIDER=claude`일 때) |
| `LLM_PROVIDER` | `gpt` 또는 `claude` (기본값: `gpt`) |
| `DB_PATH` | SQLite DB 경로 (기본값: `./data/db.sqlite`) |

---

## 사용법

1. BotFather에서 봇을 생성합니다.
2. 봇을 원하는 텔레그램 그룹에 초대합니다.
3. 그룹에서 `/on` 을 실행하여 봇을 활성화합니다.
4. 상장 공지를 해당 방에 포워딩하면 기사가 자동 생성됩니다.

### 자동 감지 키워드

| 거래소 | 키워드 |
|--------|--------|
| 업비트 | 신규 거래지원 |
| 빗썸 | 원화마켓 추가 |

위 키워드가 포함된 메시지만 처리합니다. 그 외는 무시됩니다.

### 웹 폴링

봇이 `/on` 상태이면 업비트·빗썸 공지 페이지를 주기적으로 폴링하여 신규 상장 공지도 자동으로 감지합니다.

---

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/on` | 해당 방에서 봇 활성화 |
| `/off` | 해당 방에서 봇 비활성화 |
| `/status` | 현재 봇 상태 확인 |

---

## 빌드 및 실행

```bash
npm run build   # TypeScript 컴파일
npm start       # 프로덕션 실행
npm run dev     # 개발 모드 (tsx watch)
```

Node.js **20 이상** 필요합니다.

---

## 프로젝트 구조

```
src/
├── bot/            # Telegram 커맨드 및 메시지 핸들링
├── llm/            # LLM 프로바이더 (GPT / Claude)
├── publisher/      # 기사 및 배포 메시지 생성
├── scraper/        # 공지 본문 스크래핑 (Cheerio + Playwright)
├── storage/        # SQLite DB 연동
├── utils/          # 로깅, 재시도 등 공통 유틸
└── watcher/        # 업비트/빗썸 공지 폴링 및 스케줄링
prompts/            # LLM 프롬프트 파일
assets/             # 거래소별 배포 이미지
```
