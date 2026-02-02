# Architecture.md
listing_bot_blockmedia — Technical Architecture (TypeScript + Claude API)

## 1. 개요
텔레그램 공지 채널을 모니터링하여 업비트/빗썸 신규 상장 공지(첫 공지)만 자동 기사화하고, 동일 내용을 텔레그램 배포용 보도자료 메시지로 한 번 더 생성해 전송하는 텔레그램 봇.

한 공지 처리 결과물
- 메시지 1: 기사 본문(article_message)
- 메시지 2: 배포용 보도자료(press_release_message) + 이미지 첨부

## 2. 요구사항 요약
입력
- 텔레그램 새우잡이어선 공지방(-1001379897604) 메시지
- 메시지 내부 공지 링크(업비트/빗썸 공지 페이지)

필터링
- "업비트(Upbit) 공지 '코인' 신규 거래 지원 안내"
- "빗썸(Bithumb) 원화마켓 추가"
- 공지변경/거래대기/에어드랍 등은 제외
- 동일 티커에 대해 “첫 공지”만 처리

생성
- 기사: prompts/upbit_listing prompt.txt 또는 prompts/bithumb_listing prompt.txt 적용
- 배포 메시지: 고정 포맷 + 기사 첫 2문장 + #TICKER + “기사 보기 👉 링크 추후 삽입”
- 이미지: upbit_listing_image.jpg 또는 bithumb_listing_image.jpg

운영
- 봇을 다른 채팅방에 초대하면 그 채팅방에서 /on /off 가능
- off일 때는 공지 처리 자체를 하지 않음(메시지 전송 없음)

## 3. 기술 스택
- 언어: TypeScript (Node.js 20+ 권장)
- Telegram: Bot API (grammY 또는 telegraf 중 택1)
- HTTP: undici 또는 axios
- HTML 파싱/스크래핑: cheerio (정적 HTML), 필요 시 playwright(동적 페이지 대응)
- 저장소: SQLite (better-sqlite3) 또는 PostgreSQL(확장 시)
- LLM: Claude API (Anthropic)
- 런타임: Docker(선택), PM2(선택)

권장 라이브러리 조합(간단, 운영 친화)
- grammY + @grammyjs/conversations(커맨드 처리)
- undici + cheerio
- better-sqlite3
- zod(JSON 스키마 검증)
- pino(로깅)

## 4. 상위 아키텍처
구성 요소
1) Telegram Ingestion
- 공지방(-1001379897604) 모니터링
- 봇이 초대된 다른 채팅방들에서 /on /off 커맨드 처리

2) Filter + Dedup
- 업비트/빗썸 상장 공지 식별
- 제외 키워드 제거
- 티커 단위 “첫 공지” 여부 확인(영속 저장)

3) Scraper
- 공지 링크 접속
- 공지 전문 텍스트 추출 및 정규화

4) Prompt Router
- exchange 판별 결과에 따라 prompts/ 파일 로드

5) Claude Generator
- (프롬프트 파일 + 공지 전문)으로 Claude 호출
- JSON 응답 파싱/검증
- article_message + press_release_message 확보

6) Publisher
- 채팅방으로 2개 메시지 전송
  - 기사 본문: 텍스트만
  - 보도자료: 이미지 첨부 + 캡션(press_release_message)

## 5. 데이터 흐름(시퀀스)
1. Telegram update 수신
2. 메시지 텍스트에서 키워드 매칭(Upbit/Bithumb)
3. 제외 키워드 검사 → 해당되면 종료
4. 링크 추출(없으면 종료)
5. 링크 스크래핑 → 공지 전문 텍스트 확보
6. 공지 전문에서 티커 추출(정규식/파서)
7. DB에서 exchange:ticker 존재 여부 확인
   - 존재하면 종료(첫 공지 아님)
   - 없으면 처리 계속
8. 프롬프트 파일 로드
9. Claude 호출 → JSON 응답 확보
10. 메시지 전송(2개)
11. DB에 exchange:ticker 처리 완료 기록
12. 로그/메트릭 기록

## 6. 디렉토리 구조(권장)
listing-bot-blockmedia/
  src/
    index.ts
    bot/
      telegram.ts
      commands.ts
      filters.ts
      router.ts
    scraper/
      notice_scraper.ts
      browser_manager.ts
      parsers.ts
    llm/
      claude.ts
      schema.ts
      prompt_loader.ts
    publisher/
      telegram_publisher.ts
      press_release.ts
    storage/
      db.ts
      migrations.ts
      repositories.ts
    utils/
      logger.ts
      retry.ts
      text.ts
  prompts/
    upbit_listing prompt.txt
    bithumb_listing prompt.txt
  assets/
    upbit_listing_image.jpg
    bithumb_listing_image.jpg
  .env.example
  package.json
  tsconfig.json

## 7. 저장소 설계(SQLite 기준)
테이블 1: chat_settings
- chat_id INTEGER PRIMARY KEY
- enabled INTEGER NOT NULL (0/1)
- updated_at TEXT

테이블 2: processed_listings
- id INTEGER PRIMARY KEY AUTOINCREMENT
- exchange TEXT NOT NULL (UPBIT/BITHUMB)
- ticker TEXT NOT NULL
- first_seen_at TEXT NOT NULL
- notice_url TEXT NOT NULL
- notice_hash TEXT (선택: 공지 전문 해시)
- UNIQUE(exchange, ticker)

테이블 3: job_logs(선택)
- id INTEGER PRIMARY KEY AUTOINCREMENT
- created_at TEXT
- level TEXT (INFO/WARN/ERROR)
- event TEXT
- payload TEXT(JSON)

중복 방지 키
- UNIQUE(exchange, ticker)

주의
- “첫 공지” 원칙이면 exchange+ticker만으로 충분
- 예외적으로 같은 티커가 여러 거래소/마켓에 걸쳐 반복 상장될 수 있으니 exchange는 포함해야 함

## 8. 공지 분류와 티커 추출
1) 분류(텔레그램 메시지)
- UPBIT: 문자열에 "업비트(Upbit) 공지 '코인' 신규 거래 지원 안내" 포함
- BITHUMB: 문자열에 "빗썸(Bithumb) 원화마켓 추가" 포함

2) 제외
- 메시지 텍스트에 제외 키워드가 있으면 무조건 skip

3) 티커 추출(공지 전문 텍스트 기준 권장)
- 공지 전문에는 보통 “프로젝트명(영문명·TICKER)” 형태가 포함됨
- 우선순위
  - 패턴: 가운데점(·) 뒤 대문자+숫자 조합
  - 패턴: 심볼: XXX
  - 패턴: 티커: XXX
- 추출 실패 시에는 Claude 호출 전에 실패 처리(재시도 1회)
- 잘못된 티커로 dedup이 생기면 치명적이므로 보수적으로 처리한다.

## 9. 스크래핑(공지 전문 확보) - 2단계 파이프라인

### 문제: 업비트 SPA 구조
- 업비트 공지 페이지는 **SPA(Single Page Application)** 구조
- 최초 HTML은 거의 빈 껍데기 (`<div id="root"></div>`)
- 실제 본문은 JavaScript로 동적 렌더링됨
- **cheerio는 정적 HTML만 파싱** → 본문 추출 실패 (0글자)

### 해결: 2단계 스크래핑 파이프라인

#### Stage 1: Static Extractor (cheerio)
**파일**: `notice_scraper.ts` - `extractContentFromHtml()`
**대상**: 빗썸 등 정적 HTML 페이지
**동작**:
1. HTTP 요청 (undici)
2. HTML 파싱 (cheerio)
3. 특정 셀렉터 우선 추출:
   - Upbit: `.notice-view-content`, `.notice-content`, `.view-content`, `article`
   - Bithumb: `.board-content`, `.notice-content`, `.view-content`
4. 실패 시 generic selectors: `main`, `article`, `.content`, `#content`
5. 최종 폴백: `body` 전체

**성공 조건**: 본문 텍스트 200자 이상

#### Stage 2: Dynamic Renderer (Playwright)
**파일**: `notice_scraper.ts` - `scrapeWithPlaywright()`, `browser_manager.ts`
**대상**:
- **업비트 공지 (기본 경로)**
- 또는 Static Extractor 실패 시 폴백

**동작**:
1. 브라우저 컨텍스트 생성 (싱글톤 브라우저 재사용)
2. 페이지 이동: `page.goto(url, { waitUntil: 'domcontentloaded' })`
3. 콘텐츠 대기:
   - Strategy 1: `waitForSelector()` - 특정 셀렉터 등장 대기 (5초)
   - Strategy 2: `waitForTimeout(2000)` - JS 실행 대기
4. DOM에서 콘텐츠 추출 (`page.evaluate()`):
   - Upbit 셀렉터 시도
   - 실패 시 텍스트 밀도 휴리스틱 (가장 긴 textContent 요소)
   - 최종 폴백: `document.body.textContent`
5. 디버깅: 실패 시 HTML 저장 (`data/debug/upbit_notice_<timestamp>.html`)

### 브라우저 관리 (browser_manager.ts)

**싱글톤 패턴**:
- 프로세스 생명주기 동안 **브라우저 인스턴스 1개만 생성**
- 각 스크래핑 요청마다 **컨텍스트만 새로 생성/종료**
- 리소스 효율성 + 안정성

**리소스 최적화**:
- 리소스 차단 (route interception):
  - `image`, `font`, `media` → 차단 (abort)
  - `stylesheet`, `document`, `script` → 허용 (continue)
- User-Agent 설정
- 헤드리스 모드 (`headless: true`)
- 최적화 args:
  ```
  --no-sandbox
  --disable-setuid-sandbox
  --disable-dev-shm-usage
  --disable-accelerated-2d-canvas
  --disable-gpu
  ```

**생명주기 관리**:
- Process exit/SIGINT/SIGTERM 시 브라우저 자동 종료
- Context는 매번 생성 후 반드시 `finally` 블록에서 종료

### 스크래핑 전략 분기

```typescript
if (url.includes('upbit.com')) {
  // 업비트: 무조건 Playwright (SPA)
  content = await scrapeWithPlaywright(url);
} else {
  // 빗썸 등: Static 먼저 → 실패 시 Playwright
  try {
    content = await scrapeStatic(url);
    if (content.length < 200) throw new Error('Too short');
  } catch {
    content = await scrapeWithPlaywright(url);
  }
}
```

### 추출 목표
- "안녕하세요… 신규 디지털 자산 거래지원을…" 이하 **공지 본문 전체**
- 표(디지털 자산/마켓/네트워크/시간)도 텍스트로 포함
- 사람이 복사-붙여넣기한 수준의 완전한 텍스트

### 검증
- 길이: 200자 미만이면 실패
- 키워드: "거래", "지원", "신규", "디지털" 중 하나 필수 (경고)

### 타임아웃 & 재시도
- Playwright 타임아웃: 15초
- 스크래핑 실패 시 재시도: 최대 2회 (retry.ts에서 처리)
  - 1회: 500ms 후
  - 2회: 2000ms 후

## 10. LLM 호출 설계(Claude API)
입력 구성
- system: 고정 규칙(추측 금지, JSON만 출력, 2개 메시지 필수)
- user:
  1) 선택된 프롬프트 파일 전문
  2) "복사한 공지사항 전문" 전문

출력 강제(JSON)
- zod로 스키마 검증
- 검증 실패 시 1회 재시도(“JSON만 다시 출력” 리페어 프롬프트)

스키마(src/llm/schema.ts)
- exchange: enum
- ticker: string
- title: string
- article_message: string
- press_release_message: string

## 11. Telegram 전송 설계
전송 대상
- 기본: 봇이 동작 on인 채팅방(봇이 초대된 곳)
- 공지방(-1001379897604)에서 공지가 뜨면, 결과는 다음 중 택1
  A) 공지방에 그대로 전송
  B) 별도 운영 채팅방에 전송
  C) 공지방은 입력 전용, 결과는 enable된 채팅방들로 브로드캐스트
운영 정책에 따라 config로 선택 가능

메시지 1: 기사 본문
- 텍스트 그대로 sendMessage

메시지 2: 보도자료 + 이미지
- sendPhoto(assets/xxx.jpg) + caption(press_release_message)

보도자료 캡션 포맷 생성(press_release.ts)
- title 줄
- [블록미디어 ***] 첫 문장 + 두 번째 문장
- #TICKER
- 기사 보기 👉 링크 추후 삽입

첫 문장/두 번째 문장 추출 규칙(권장)
- article_message에서 문장 단위로 2개 추출
- 마침표/다. 기준으로 분리(한국어 기사이므로 “.”보다 “다.” 우선)
- 실패하면 첫 200자 내에서 문장 2개 휴리스틱

## 12. 채팅방 on/off 설계
커맨드
- /on: chat_settings.enabled = 1
- /off: chat_settings.enabled = 0
- /status: enabled 상태와 현재 버전 출력

관리자 제한(권장)
- getChatMember로 호출자 권한 확인
- administrator/creator만 /on /off 허용
- 개인 채팅(1:1)에서는 제한 없이 허용

기본 상태
- 안전하게 가려면 기본 off
- 운영 편의로 공지방은 입력 전용이면 공지방은 상태 무관하게 수집만 하고, 출력은 별도 방 on에만 전송하도록 설계 가능

## 13. 설정(.env, config)
.env.example
- TELEGRAM_BOT_TOKEN=
- ANTHROPIC_API_KEY=
- DB_PATH=./data/db.sqlite
- LISTING_SOURCE_CHAT_ID=-1001379897604
- DEFAULT_ENABLED=0
- OUTPUT_MODE=single|broadcast|source_only (정의는 운영에 맞춰 선택)
- LOG_LEVEL=info

config.json 또는 config.yaml(선택)
- excluded_keywords 배열
- upbit_keyword, bithumb_keyword
- prompt_paths
- asset_paths

## 14. 관측성/로그
필수 로그 이벤트
- telegram.update_received
- listing.detected(exchange, url)
- listing.skipped(reason)
- notice.scrape_success(length)
- notice.scrape_failed(error)
- llm.success(tokens, latency)
- llm.failed(error)
- publish.success
- publish.failed

추가 메트릭(선택)
- 처리 지연(ms)
- 공지당 평균 토큰
- 실패율

## 15. 에러/재시도 정책
재시도 대상
- 스크래핑 fetch 실패: 최대 2회(백오프 0.5s, 2s)
- Claude API: 최대 2회(백오프 1s, 3s)
- Telegram 전송 실패: 최대 2회(백오프 1s, 3s)

부분 성공 금지
- 메시지 1만 보내고 메시지 2 실패하면, 전체 실패로 보고 재시도
- 재시도 중복 전송 방지를 위해 job_id를 만들어 “이미 보냈는지” 추적(선택)
  - 초기에는 단순하게 “전송 직전 DB에 기록”을 하지 말고 “전송 성공 후 기록”으로 중복을 줄인다.

## 16. 보안
- API 키는 .env로만 관리
- DB 파일 gitignore
- 로그에 공지 전문 전체를 남기지 말고 길이/해시만 남긴다(권장)
- Claude 입력에는 공지 전문 전체를 넣되, 외부 전송은 생성 결과물만

## 17. MVP 구현 순서
1) 텔레그램 봇 수신 + /on /off /status + chat_settings 저장
2) 특정 공지방(-1001379897604) 메시지 수신 및 필터링
3) 링크 추출 + 스크래핑으로 공지 전문 확보
4) 티커 추출 + processed_listings dedup
5) 프롬프트 파일 로드 + Claude 호출 + JSON 검증
6) 메시지 2개 전송(기사, 보도자료+이미지)
7) 성공 후 processed_listings 기록

## 18. 향후 확장
- 업비트/빗썸 공지 파서 정확도 향상(셀렉터 고도화)
- 기사 업로드 연동 후 링크 자동 삽입
- 다중 소스 채널 지원(여러 공지방/여러 거래소)
- 관리자 대시보드(최근 처리 내역, on/off 현황, 실패 재처리 버튼)
