# TODO

## 브랜드 소싱

- [ ] 소싱 대상 국가에 벨기에 추가 검토. 벨기에 초콜릿은 한국 소비자 신뢰도가 스위스급으로 높아서
      (Neuhaus, Côte d'Or, Leonidas 등) 기준엔 부합함. 다만 프랑스어/네덜란드어 이중언어권이라
      전용 lane(언어별 쿼리, 제조업체 명사)이 새로 필요하고, France lane과 일부 후보가 겹칠 수 있음.
- [x] ~~Claude/Anthropic API 기반 소싱~~ — 코드 삭제 완료 (고아 코드였음, 실제 쓰이는 건 Python 엔진뿐).
- [x] ~~SharePoint 동기화~~ — 안 쓰기로 결정, 코드 전체 삭제 완료.

## 인증 / 권한

- [ ] 권한(role/allowedPages) 변경이 재로그인 전까지 반영 안 되는 문제 — JWT 세션이 stateless라
      관리자가 권한을 바꿔도 당사자가 직접 로그아웃하지 않는 한 구 권한으로 계속 로그인된 상태 유지됨
      (세션 만료도 30일 rolling이라 사실상 무기한 유지될 수 있음). 강제 로그아웃 수단이 전혀 없음.
      제안된 해법: `User.tokenVersion Int @default(0)` 추가 → 권한 변경 시 증가 → 대시보드
      레이아웃([layout.tsx](src/app/(dashboard)/layout.tsx))에서 JWT의 tokenVersion과 DB 값을 비교해
      다르면 강제 signOut. 미들웨어(`proxy.ts`)는 Edge Runtime이라 이 체크를 못 넣어서, 권한 변경 직후
      딱 1 request는 구 권한으로 통과할 수 있는 한계는 있음.

