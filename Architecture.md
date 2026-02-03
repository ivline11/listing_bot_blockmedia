# listing_bot_blockmedia — Architecture

## 1. 개요

업비트·빗썸 신규 상장 공지를 감지하여 기사 초안과 텔레그램 배포 메시지를 자동 생성하고, `/on` 상태인 채팅방에 배포하는 텔레그램 봇.

입력 소스는 두 가지로 병렬 운영된다.

| 경로 | 트리거 | 배포 대상 |
|------|--------|-----------|
| 웹 폴링 | scheduler가 업비트·빗썸 공지 목록을 주기적으로 폴링 | enabled 채팅방 **전체** (broadcast) |
| 텔레그램 트리거 | `/on` 방에서 누구든 공지를 포워딩·직접 올림 | **해당 방만** |

두 경로 모두 동일한 처리 파이프라인(`processListingAnnouncement`)으로 합류한다.

---

## 2. 시작 순서 (index.ts)

```
1. 환경 변수 검증
2. SQLite DB 초기화 + 마이그레이션
3. LLM 프로바이더 초기화 (GPT 기본, LLM_PROVIDER=claude로 전환 가능)
4. Playwright Chromium 브라우저 launch (첫 실행 시 자동 설치)
5. grammY 봇 생성 + 메시지 핸들러 등록
6. 웹 폴링 스케줄러 시작
7. bot.start()
```

---

## 3. 모듈 구조

```
src/
├── index.ts                    # 진입점 — 초기화 & 시작
├── bot/
│   ├── telegram.ts             # grammY Bot 생성
│   ├── commands.ts             # /on /off /status /start
│   ├── filters.ts              # 거래소 감지 + 제외 키워드 필터
│   └── router.ts               # 처리 파이프라인 + 메시지 핸들러
├── watcher/
│   ├── upbit_watcher.ts        # 업비트 공지 목록 폴링 (Playwright)
│   ├── bithumb_watcher.ts      # 빗썸 공지 목록 폴링 (Playwright)
│   └── scheduler.ts            # 폴링 루프 관리 + 백오프 + 첫실행 seed
├── scraper/
│   ├── notice_scraper.ts       # 공지 상세 페이지 본문 추출 (Playwright)
│   ├── browser_manager.ts      # Playwright 싱글톤 (launch / context / close)
│   └── parsers.ts              # 본문에서 티커 추출
├── llm/
│   ├── provider.ts             # GPT | Claude 프로바이더 팩토리
│   ├── gpt.ts                  # OpenAI GPT 호출 + JSON 파싱 + Zod 검증
│   ├── claude.ts               # Anthropic Claude 호출
│   ├── prompt_loader.ts        # prompts/*.txt 파일 로드
│   └── schema.ts               # Zod 응답 스키마
├── publisher/
│   ├── telegram_publisher.ts   # 단일·다중 채팅방 전송
│   └── press_release.ts        # PR 메시지 템플릿 + 이미지 경로
├── storage/
│   └── db.ts                   # SQLite (better-sqlite3) + 테이블 정의
└── utils/
    ├── text.ts                 # URL 추출, 티커 정규식, 제외 키워드 체크
    ├── retry.ts                # withRetry + 백오프 설정
    └── logger.ts               # pino 로거
```

---

## 4. 커맨드

| 커맨드 | 동작 |
|--------|------|
| `/on` | 현재 채팅방을 enabled로 설정 |
| `/off` | 현재 채팅방을 disabled로 설정 |
| `/status` | 현재 방의 on/off 상태 표시 |
| `/start` | 사용법 안내 |

- Bot API 기반 → 봇을 초대하면 즉시 사용 가능. 특정 유저 제한 없음.
- 누구든 포워딩·직접 메시지 → `/on` 방이면 처리.

---

## 5. 공지 필터링 (filters.ts)

**감지 패턴** (공백 제거 후 매칭)

| 거래소 | 필수 키워드 조합 |
|--------|-----------------|
| UPBIT | `업비트` + `신규거래지원` |
| BITHUMB | `빗썸` + `원화마켓추가` |

**제외 키워드** (제목·본문에 포함되면 skip)

`공지변경`, `거래대기`, `에어드랍`, `이벤트`, `리브랜딩`, `마켓명 변경`, `유의종목`, `투자유의`, `입출금 중단`, `점검`

---

## 6. 웹 폴링 (watcher/ + scheduler.ts)

### 폴링 주기

- 기본 간격: **45초**
- 실패 시 백오프: 5s → 10s → 30s → 60s
- 성공 시 즉시 기본 간격으로 복귀

### 첫 실행 seed

첫 폴링 시 기존 공지를 `polled_notices`에 기록하고 **처리하지 않는다**.
이후 폴링에서 새로운 notice_id만 파이프라인으로 넘긴다.

### 폴링 조건

enabled 채팅방이 1개 이상이어야 폴링 실행. 0개이면 루프 유지 중 skip.

### 합류 방식

새 공지 감지 시 `createSyntheticMessage()`로 메시지를 생성하여 `processListingAnnouncement(bot, message)`에 sourceChatId **없이** 호출 → broadcast 경로.

---

## 7. 텔레그램 트리거 (router.ts)

`message:text` + `channel_post` 핸들러로 수신.

- `text_link` entity에서 숨겨진 URL도 추출하여 메시지본문에 추가.
- `processListingAnnouncement(bot, messageText, chatId)`에 sourceChatId를 넘김 → **해당 방만** 배포 대상.

---

## 8. 처리 파이프라인 (router.ts — processListingAnnouncement)

```
① filterListingMessage()        — 거래소 감지 + 제외 키워드 체크
② extractUrl()                  — 메시지에서 공지 URL 추출
③ scrapeNotice(url)             — Playwright로 공지 본문 스크래핑
④ parseNoticeForTicker()        — 본문에서 티커 추출
⑤ llm.generateArticle()        — GPT/Claude로 기사 생성 (JSON)
⑥ generatePressReleaseMessage() — PR 메시지 템플릿 조합
⑦ publishToMultipleChats()      — 대상 방에 메시지 2개 + 이미지 전송
⑧ job_logs 테이블에 결과 기록
```

재시도 정책: 스크래핑·LLM·텔레그램 전송 각각 독립적으로 `withRetry` 적용.

---

## 9. 스크래핑 (scraper/)

**단일 단계 — Playwright만 사용.**

- `browser_manager.ts`: Chromium 싱글톤. 첫 호출 시 설치 체크 후 launch. context는 요청당 생성·종료. 이미지·폰트·미디어 요청 차단.
- `notice_scraper.ts`: 페이지 로드 후 nav/header/footer 제거 → 키워드 스코링으로 본문 후보 선발. 최소 200자 검증.
- `parsers.ts`: 본문에서 티커 정규식 추출 (`·TICKER`, `심볼: TICKER`, `(TICKER)` 패턴).

---

## 10. LLM 생성 (llm/)

| 항목 | 내용 |
|------|------|
| 기본 프로바이더 | GPT (`LLM_PROVIDER` 미설정 시) |
| 전환 방법 | `LLM_PROVIDER=claude` |
| 프롬프트 | `prompts/upbit_listing_prompt.txt` · `prompts/bithumb_listing_prompt.txt` |
| 응답 형식 | JSON — `exchange`, `ticker`, `title`, `article_message`, `press_release_message` |
| 검증 | Zod 스키마로 파싱 후 필수필드 확인 |

---

## 11. 배포 (publisher/)

### 전송 내용 (메시지 2개)

1. **기사 본문** — `sendMessage` (HTML parse_mode, 링크 미리보기 off)
2. **PR 메시지 + 이미지** — `sendPhoto` + caption. 이미지 없으면 `sendMessage` fallback.

### 이미지

- `assets/upbit_listing_image.jpg`
- `assets/bithumb_listing_image.jpg`

### 배포 대상 결정

| 경로 | 대상 |
|------|------|
| 웹 폴링 (sourceChatId 없음) | `OUTPUT_MODE=broadcast` → enabled 방 전체 |
| 텔레그램 트리거 (sourceChatId 있음) | 트리거된 방 1개만 |

`OUTPUT_MODE=single`로 하면 웹 폴링도 `OUTPUT_CHAT_ID` 한 곳에만 전송.

---

## 12. DB (storage/db.ts — SQLite)

| 테이블 | 역할 |
|--------|------|
| `chat_settings` | chat_id → enabled (0/1) |
| `polled_notices` | 웹 폴링 중복 방지 — (exchange, notice_id) UNIQUE |
| `processed_listings` | (exchange, ticker) UNIQUE — 테이블 유지, 현재 파이프라인에서는 기록 안함 |
| `job_logs` | 처리 성공·실패 이벤트 로그 |

---

## 13. 재시도 정책 (utils/retry.ts)

| 대상 | 재시도 횟수 | 백오프 |
|------|------------|--------|
| 스크래핑 | 3회 | 500ms → 2000ms |
| LLM 호출 | 3회 | 1000ms → 3000ms |
| 텔레그램 전송 | 3회 | 1000ms → 3000ms |

전송 시 부분 실패(일부 방만 실패)는 전체 실패로 간주하지 않는다. 최소 1개 성공이면 성공 처리.

---

## 14. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✓ | grammY Bot API 토큰 |
| `DB_PATH` | ✓ | SQLite 파일 경로 |
| `OPENAI_API_KEY` | GPT 사용 시 | OpenAI API 키 |
| `ANTHROPIC_API_KEY` | Claude 사용 시 | Anthropic API 키 |
| `LLM_PROVIDER` | | `gpt` (기본) 또는 `claude` |
| `OUTPUT_MODE` | | `broadcast` (기본) 또는 `single` |
| `OUTPUT_CHAT_ID` | single 모드 시 | 단일 출력 채팅방 ID |

---

## 15. 기술 스택

| 영역 | 라이브러리 |
|------|-----------|
| Telegram Bot | grammY |
| 동적 렌더링·스크래핑 | Playwright (Chromium) |
| HTTP | undici |
| DB | better-sqlite3 (SQLite) |
| LLM | OpenAI SDK / @anthropic-ai/sdk |
| 스키마 검증 | zod |
| 로깅 | pino + pino-pretty |
| 런타임 | Node.js 20+ / TypeScript |
