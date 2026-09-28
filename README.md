# OnriKorea AI

온리코리아(OnriKorea) 글로벌사업부를 위한 사내 업무 자동화 플랫폼입니다. 해외 헤리티지 브랜드 발굴부터 브랜드 관리, 할 일 트래킹, 현장(매장) 방문 기록까지 팀의 업무 흐름을 하나의 대시보드로 통합합니다. 한국어를 기본 언어로 하며, 영어 전환도 지원합니다.

## 개요

- 로그인 기반 사내 도구 — 계정별 권한(관리자/일반 사용자)과 접근 가능 페이지를 관리자가 직접 설정
- 대시보드에서 소싱·기획·현장 업무를 한눈에 확인
- 웹 검색 기반 브랜드 발굴 파이프라인으로 신규 소싱 후보를 자동 수집·검증 (현재 실행 버튼 비활성화, 아래 진행 상태 참고)
- 담당자별 할 일 관리와 매장 방문 기록을 통해 팀 운영 현황을 추적
- 올린 컨텐츠(브랜드·할 일·매장·방문 기록·상품·댓글 등)는 작성자 본인 또는 관리자만 수정·삭제 가능
- Excel/SharePoint 연동으로 기존 오피스 워크플로우와 병행 가능 (현재 비활성화, 아래 진행 상태 참고)

## 기술 스택

**Frontend / Backend**
- [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Server Components) — 프론트와 백엔드가 한 코드베이스
- [React 19](https://react.dev/) + TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) 기반 컴포넌트 (`@base-ui/react`)
- [next-themes](https://github.com/pacocoursey/next-themes) (다크/라이트 모드), [lucide-react](https://lucide.dev/) 아이콘

**데이터 / 검증**
- PostgreSQL (Supabase) + [Prisma 7](https://www.prisma.io/) (`@prisma/adapter-pg`) — 스키마는 `prisma db push`로 직접 반영 (별도 마이그레이션 이력 없음)
- [Zod](https://zod.dev/)로 모든 서버 액션의 입력 검증
- [Vercel Blob](https://vercel.com/storage/blob) — 첨부파일·사진 저장
- `xlsx` — Excel import/export

**인증 / 권한**
- [Auth.js (next-auth v5)](https://authjs.dev/) — 아이디/비밀번호 로그인 (Credentials Provider, 회사 SSO 아님)
- 계정별 역할(관리자/일반 사용자) + 페이지 단위 접근 권한을 관리자가 `/settings/users`에서 관리
- 컨텐츠 단위 권한: 각 레코드(브랜드, 할 일, 매장, 방문 기록, 상품, 댓글 등)는 생성자 정보를 저장하며, 수정/삭제는 작성자 본인 또는 관리자만 가능

**보안**
- CSP(Content-Security-Policy) 등 보안 헤더 (`next.config.ts`)
- 업로드 파일 타입 검증 (허용된 이미지/첨부파일 확장자 외 차단)
- 상태 변경 API에 Origin 검증(CSRF 방어)
- 비밀번호 복잡도 정책 강제 (8자 이상, 문자/숫자/특수문자 각 1개 이상)

**배포**
- Vercel — 앱과 Supabase Postgres가 배포 환경

**연동 (일부 준비 중)**
- Microsoft Graph (`@microsoft/microsoft-graph-client`, `@azure/identity`) — SharePoint 엑셀 동기화 (현재 비활성화)
- Anthropic API (`@ai-sdk/anthropic`, Vercel AI SDK) — 브랜드 후보 AI 검증 (Python 발굴 엔진과 함께 현재 비활성화)

**브랜드 발굴 엔진 (Python, 현재 비활성화)**
- `python-sourcing/` — Tavily Search API로 후보 브랜드를 웹에서 검색·수집
- 도메인-이름 매칭, 카테고리/차단 도메인 필터링 등 순수 알고리즘 기반 품질 검증
- `psycopg2`로 같은 Postgres DB에 직접 적재, Node 서버 액션이 서브프로세스로 실행 (Vercel엔 Python 런타임이 없어 배포 환경에서는 동작 불가)

## 주요 기능

### 로그인 (`/login`)
- 아이디/비밀번호 로그인, 관리자가 계정을 생성하고 기본 비밀번호로 초기화
- 비로그인 상태로는 어떤 페이지도 접근 불가 (미들웨어에서 강제 리다이렉트)

### 설정 (`/settings`)
- **내 계정**: 비밀번호 변경 (복잡도 정책 적용)
- **사용자 관리** (관리자 전용, `/settings/users`): 계정 생성/수정/삭제, 역할(관리자/일반) 지정, 일반 사용자별로 볼 수 있는 페이지(브랜드/브랜드 발굴/할 일/매장/방문 기록/상품)를 체크박스로 개별 지정, 비밀번호를 기본값으로 초기화
- 권한 변경은 해당 사용자의 다음 로그인부터 적용 (세션이 JWT 기반이라 즉시 반영은 아님)

### 대시보드
소싱·기획·현장 각 모듈의 빠른 진입점을 모아 보여주는 홈 화면. 접근 권한이 없는 모듈은 자동으로 숨김.

### 브랜드 (`/brands`)
- 브랜드 CRUD, 검색, 페이지네이션
- Excel 가져오기/내보내기
- 등록한 사람 본인 또는 관리자만 수정/삭제 가능

### 브랜드 발굴 (`/brands/sourcing`)
- Python 엔진으로 신규 헤리티지 브랜드 후보를 웹에서 자동 검색 (현재 실행 버튼 비활성화)
- 후보별 판정(통과/검토/거절), 국가·카테고리·설립연도 등 정규화된 정보 표시
- 체크박스 기반 다중 선택 → 선택한 후보를 브랜드로 일괄 추가하거나 일괄 삭제

### 할 일 (`/work`)
- 담당자별 할 일 목록, 카테고리(하위 분류)별 필터링, 사이드바 트리 뷰
- 카테고리 드래그 앤 드롭으로 다른 담당자에게 일괄 재배정
- 할 일 상세 페이지에서 상태 변경, 댓글/답글(작성자 본인만 수정·삭제 가능), 파일 첨부
- 작성자 본인 또는 관리자만 할 일 자체를 수정/삭제 가능

### 현장 (`/field`)
- **매장**: 매장 마스터 데이터 관리(체인, 유형, 주소, 사진), 활성/비활성 전환
- **방문 기록**: 매장별 방문 기록 생성, 방문 중 확인한 상품 항목·가격·진열 상태 기록, 사진 업로드
- **상품**: 매장 방문에서 등록되는 상품 목록을 한 곳에서 조회
- 매장/방문 기록/상품/사진 모두 작성자 본인 또는 관리자만 수정·삭제 가능
- 매장 삭제 시 방문 기록이 남아있으면 차단 (데이터 무결성 보호)

### 다국어 / 테마
- 한국어(기본) / 영어 전환, 사이드바에서 즉시 변경
- 시스템/라이트/다크 테마 지원

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인합니다.

스키마(`prisma/schema.prisma`)를 바꿨다면 반영 후 개발 서버를 재시작해야 합니다:

```bash
npx prisma db push
npx prisma generate
```

### 필요 환경 변수 (`.env`)

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | Postgres 연결 (풀링, 앱 런타임용) |
| `DIRECT_URL` | Postgres 직접 연결 (Prisma CLI용) |
| `AUTH_SECRET` | 로그인 세션 서명/암호화 (로컬 생성값, 외부 자격 증명 아님) |
| `DEFAULT_RESET_PASSWORD` | 신규 계정 생성/비밀번호 초기화 시 사용하는 기본 비밀번호 |
| `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` | Vercel Blob 파일 업로드 |
| `TAVILY_API_KEY` | 브랜드 발굴 웹 검색 (Python 엔진) |
| `ANTHROPIC_API_KEY` | AI 기반 브랜드 후보 검증 |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Microsoft Graph (SharePoint 동기화) |
| `SHAREPOINT_SYNC_FILE_URL` | 동기화 대상 SharePoint 엑셀 파일 |

Python 브랜드 발굴 엔진을 로컬에서 실행하려면:

```bash
cd python-sourcing
pip install -r requirements.txt
```

## 진행 상태

- ✅ 로그인/인증, 역할·페이지별 권한 관리(`/settings`): 운영 중
- ✅ 컨텐츠 작성자/관리자 전용 수정·삭제 권한: 운영 중
- ✅ 브랜드/할 일/현장(매장·방문 기록·상품) 모듈: 운영 중
- ✅ 보안 하드닝(CSP, 파일 타입 검증, CSRF Origin 검증, 비밀번호 정책): 운영 중
- 🚧 Python 브랜드 발굴 엔진 실행: 실제 운영 검증 전까지 버튼 비활성화
- 🚧 SharePoint 동기화: 실제 운영 검증 전까지 버튼 비활성화
- 🚧 브랜드 연락처/아웃리치(콜드메일) 관리: DB 스키마와 읽기 전용 조회만 존재, 생성/수정 UI 미구현
- 🚧 일정, 주간보고: 사이드바에 자리만 있고 미구현("준비중")
- 🚧 Inngest: 의존성만 설치, 실제 백그라운드 작업/큐로 아직 연결되지 않음
