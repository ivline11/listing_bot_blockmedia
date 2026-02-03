listing_bot_blockmedia — Technical Architecture (TypeScript + Claude API)

1. 개요

이 프로젝트는 텔레그램 공지 채널을 모니터링하여 업비트 또는 빗썸 신규 상장 공지를 감지하고, 조건을 만족하는 경우 기사 초안과 텔레그램 배포 메시지를 생성해 지정된 채팅방으로 전송하는 텔레그램 봇이다.

한 공지 처리 결과:

메시지 1 — 기사 초안(article_message)

메시지 2 — 텔레그램 배포 메시지(press_release_message + 이미지)

2. 동작 모드 구조

모니터링 채널과 출력 채널은 분리되어 있다.

환경 변수:

LISTING_SOURCE_CHAT_ID = 실제 공지 모니터링 채널
TEST_ID = 테스트용 모니터링 채널


봇 모드(DB 저장):

모드	모니터링 대상	출력 위치
OFF	감지만 하고 처리 안함	전송 없음
NORMAL	LISTING_SOURCE_CHAT_ID	/on 실행한 채팅방
TEST	TEST_ID	/testmode on 실행한 채팅방
3. 텔레그램 구조
입력 채널

공지 전용 채널 (예: 새우잡이어선 공지방)

봇이 메시지를 수신만 함

제어 채널

봇을 초대한 채팅방

여기서 /on /off /testmode /status 실행

출력 채널

/on 또는 /testmode on 실행한 채팅방

결과 메시지 전송 대상

4. 기술 스택

TypeScript (Node.js 20+)

Telegram: grammY

HTTP: undici

파싱: cheerio

동적 렌더링: playwright

저장소: SQLite (better-sqlite3)

LLM: Claude API

검증: zod

로깅: pino

5. 상위 컴포넌트
Telegram Ingestion

LISTING_SOURCE_CHAT_ID 메시지 수신

TEST_ID 메시지 수신

/on /off /testmode /status 커맨드 처리

Filter Layer

업비트 / 빗썸 상장 공지 키워드 필터

제외 키워드 필터

URL 추출

Scraper

공지 링크 접속

본문 텍스트 추출

2단계 스크래핑 구조

LLM Generator

프롬프트 파일 로드

Claude 호출

기사 + 배포 메시지 생성

Publisher

출력 채팅방으로 메시지 2개 전송

이미지 첨부 포함

6. 데이터 흐름

텔레그램 메시지 수신

chat_id → source/test 채널 여부 확인

DB bot_mode 확인

모드에 맞는 채널인지 검사

필터 통과 여부 검사

URL 추출

공지 본문 스크래핑

Claude 호출

메시지 2개 생성

output_chat_id로 전송

7. 디렉토리 구조
src/
  bot/
    telegram.ts
    commands.ts
    router.ts
    filters.ts

  scraper/
    notice_scraper.ts
    browser_manager.ts
    parsers.ts

  llm/
    claude.ts
    prompt_loader.ts
    schema.ts

  publisher/
    telegram_publisher.ts
    press_release.ts

  storage/
    db.ts

  utils/
    logger.ts
    retry.ts

8. DB 구조 (최신)

중복 기사 저장 로직 제거됨.

현재 사용 테이블:

bot_mode
mode TEXT   // OFF | NORMAL | TEST
output_chat_id INTEGER
updated_at TEXT


역할:

현재 봇 동작 모드 저장

출력 대상 채팅방 저장

9. 공지 필터링

처리 대상:

업비트 신규 거래 지원 안내

빗썸 원화마켓 추가

제외 키워드:

공지변경

거래대기

에어드랍

이벤트

리브랜딩

점검

입출금 중단

유의종목

10. 스크래핑 구조
Stage 1 — Static (cheerio)

HTML 파싱

셀렉터 기반 추출

200자 이상이면 성공

Stage 2 — Dynamic (Playwright)

SPA 페이지 대응

업비트 공지 기본 경로

DOM 렌더 후 본문 추출

브라우저:

싱글톤

context 단위 생성/종료

이미지/폰트 요청 차단

11. Claude 호출

입력:

프롬프트 파일

공지 전문 텍스트

출력:

기사 텍스트

배포 메시지 텍스트

JSON 형식은 권장이나, 실패 시 재시도 가능 구조.

12. 텔레그램 전송

전송 메시지:

메시지 1

기사 본문 텍스트

메시지 2

배포 메시지 + 이미지

sendPhoto + caption

13. 커맨드
/on
/off
/testmode on
/testmode off
/status


권장:

그룹에서는 관리자만 on/off 가능

14. 재시도 정책

재시도 대상:

스크래핑 실패

Claude 호출 실패

텔레그램 전송 실패

각각 2회 재시도.

15. 로그 이벤트

message.received

filter.passed / skipped

scrape.success / failed

llm.success / failed

publish.success / failed

mode.changed

16. 보안

API 키 .env 관리

DB 파일 gitignore

공지 전문은 로그에 전체 저장하지 않음

17. MVP 순서

텔레그램 수신 + 모드 커맨드

채널 ID 기반 모니터링

필터링

스크래핑

Claude 생성

메시지 전송