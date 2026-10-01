# TODO

## 브랜드 소싱

- [ ] 소싱 대상 국가에 벨기에 추가 검토. 벨기에 초콜릿은 한국 소비자 신뢰도가 스위스급으로 높아서
      (Neuhaus, Côte d'Or, Leonidas 등) 기준엔 부합함. 다만 프랑스어/네덜란드어 이중언어권이라
      전용 lane(언어별 쿼리, 제조업체 명사)이 새로 필요하고, France lane과 일부 후보가 겹칠 수 있음.
- [ ] Claude/Anthropic API 기반 소싱(LLM이 직접 브랜드 소유권/헤리티지/패키징 판단)은 무기한 보류.
      별도 예산/크레딧 라인이 없고 생길 예정도 없음. UI에도 안 붙어 있음 — 상황 바뀌면 재검토.
      ([brands/sourcing/page.tsx:4](src/app/(dashboard)/brands/sourcing/page.tsx:4), `run-sourcing-button.tsx`는 트리에 남아있음)

## 브랜드 (SharePoint 동기화)

- [ ] 실제 SharePoint 시트에 방법론과 Name 사이에 `채널` 컬럼이 하나 더 있어서, 지금 파서
      (`parseBrandImportSheet`)로 머지하면 그 뒤 필드가 한 칸씩 밀림. 컬럼 매핑 고치기 전까지 보류.
      ([brands/page.tsx:25](src/app/(dashboard)/brands/page.tsx:25), `SyncSharePointDialog` 숨겨둔 상태)

