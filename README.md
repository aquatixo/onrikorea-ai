# OnriKorea AI

온리코리아(OnriKorea) 글로벌사업부를 위한 사내 업무 자동화 플랫폼입니다. 해외 헤리티지 브랜드 발굴부터 브랜드 관리, 할 일 트래킹, 현장(매장) 방문 기록까지 팀의 업무 흐름을 하나의 대시보드로 통합합니다. 한국어를 기본 언어로 하며, 영어 전환도 지원합니다.

## 개요

- 대시보드에서 소싱·기획·현장 업무를 한눈에 확인
- 웹 검색 기반 브랜드 발굴 파이프라인으로 신규 소싱 후보를 자동 수집·검증
- 담당자별 할 일 관리와 매장 방문 기록을 통해 팀 운영 현황을 추적
- Excel/SharePoint 연동으로 기존 오피스 워크플로우와 병행 가능

## 기술 스택

**Frontend**
- [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Server Components)
- [React 19](https://react.dev/)
- TypeScript
- Tailwind CSS v4 + [shadcn](https://ui.shadcn.com/) 기반 컴포넌트 (`@base-ui/react`)
- [next-themes](https://github.com/pacocoursey/next-themes) (다크/라이트 모드)
- [lucide-react](https://lucide.dev/) 아이콘

**Backend / 데이터**
- PostgreSQL (Supabase) + [Prisma 7](https://www.prisma.io/) (`@prisma/adapter-pg`)
- [Zod](https://zod.dev/)로 서버 액션 입력 검증
- [Vercel Blob](https://vercel.com/storage/blob) — 첨부파일·사진 저장
- `xlsx` — Excel import/export

**연동 (일부 준비 중)**
- Microsoft Graph (`@microsoft/microsoft-graph-client`, `@azure/identity`) — SharePoint 엑셀 동기화
- Anthropic API (`@ai-sdk/anthropic`) — AI 기반 브랜드 검증 (`ANTHROPIC_API_KEY` 설정 후 활성화 예정)

**브랜드 발굴 엔진 (Python)**
- `python-sourcing/` — Tavily Search API로 후보 브랜드를 웹에서 검색·수집
- 도메인-이름 매칭, 카테고리/차단 도메인 필터링 등 순수 알고리즘 기반 품질 검증 (별도 유료 AI 호출 없이 동작)
- `psycopg2`로 같은 Postgres DB에 직접 적재, Node 서버 액션이 서브프로세스로 실행

## 주요 기능

### 대시보드
소싱·기획·현장 각 모듈의 빠른 진입점을 모아 보여주는 홈 화면.

### 브랜드 (`/brands`)
- 브랜드 CRUD, 검색, 페이지네이션
- Excel 가져오기/내보내기
- SharePoint 엑셀 파일과의 단방향 동기화 (백업 다운로드 후 덮어쓰기)

### 브랜드 발굴 (`/brands/sourcing`)
- Python 엔진으로 신규 헤리티지 브랜드 후보를 웹에서 자동 검색
- 후보별 판정(통과/검토/거절), 국가·카테고리·설립연도 등 정규화된 정보 표시
- 체크박스 기반 다중 선택 → 선택한 후보를 브랜드로 일괄 추가하거나 일괄 삭제 (실행 전 확인 절차 포함)
- 실행 진행률 실시간 표시, 결과 Excel 다운로드

### 할 일 (`/work`)
- 담당자별 할 일 목록, 카테고리(하위 분류)별 필터링
- 사이드바에서 담당자·카테고리 트리를 펼치고 접을 수 있음
- 카테고리를 드래그 앤 드롭으로 다른 담당자에게 일괄 재배정
- 할 일 상세 페이지에서 상태 변경, 댓글/답글, 파일 첨부, 삭제

### 현장 (`/field`)
- **매장**: 매장 마스터 데이터 관리(체인, 유형, 주소, 사진), 활성/비활성 전환
- **방문 기록**: 매장별 방문 기록 생성, 방문 중 확인한 상품 항목·가격·진열 상태 기록, 사진 업로드
- **상품**: 매장 방문에서 재사용되는 독립적인 상품 마스터 데이터
- 매장 삭제 시 방문 기록이 남아있으면 차단 (데이터 무결성 보호)

### 다국어 / 테마
- 한국어(기본) / 영어 전환, 사이드바에서 즉시 변경
- 시스템/라이트/다크 테마 지원

### 로그인 (`/login`)
- 로그인 화면 디자인 (현재는 UI만 존재하며 실제 인증 로직은 아직 연결되지 않음)

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인합니다.

### 필요 환경 변수 (`.env`)

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | Postgres 연결 (풀링, 앱 런타임용) |
| `DIRECT_URL` | Postgres 직접 연결 (Prisma CLI/마이그레이션용) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 파일 업로드 |
| `TAVILY_API_KEY` | 브랜드 발굴 웹 검색 (Python 엔진) |
| `ANTHROPIC_API_KEY` | AI 기반 브랜드 검증 (현재 비활성화, 설정 시 재활성화) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Microsoft Graph (SharePoint 동기화) |
| `SHAREPOINT_SYNC_FILE_URL` | 동기화 대상 SharePoint 엑셀 파일 |

Python 브랜드 발굴 엔진을 로컬에서 실행하려면:

```bash
cd python-sourcing
pip install -r requirements.txt
```

## 진행 상태

- ✅ 브랜드/소싱/할 일/현장 모듈: 운영 중
- 🚧 실제 로그인/인증: 디자인만 완료, 로직 미연결
- 🚧 AI 기반 브랜드 검증: `ANTHROPIC_API_KEY` 설정 후 재활성화 예정
- 🚧 SharePoint 동기화: Azure 자격 증명 설정 후 재활성화 예정
- 🚧 브랜드 연락처/아웃리치(콜드메일) 관리: DB 스키마만 존재, UI 미구현
