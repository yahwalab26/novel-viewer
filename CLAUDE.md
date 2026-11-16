# 이 저장소를 맡은 Claude에게

웹소설 뷰어(React 18 + TS + Vite PWA / Supabase `viewer` 스키마 / GitHub Pages, 해시 라우팅 전제 `base './'`).

**시작 순서 (이대로만 하면 코인이 적게 듭니다)**
1. `ai/novel-viewer-dev/SKILL.md`를 읽는다. 위치표(§3)·우선순위(§4)·함정(§5)이 이미 정리돼 있다.
2. 저장소를 통째로 읽지 말고 `python3 ai/novel-viewer-dev/tools.py map` → `g '<정규식>'` → `sl <파일> <시작> <끝>`로 필요한 구간만 본다.
3. 작업 시작 전 `tools.py snap`, 작업 중 `tools.py check --only <이름>`, 항목 끝에 `tools.py check --build`, 전달은 `tools.py pack`(바뀐 파일만 `changed.zip`).
4. **한 번에 한 항목**: 진단 → 최소 수정 → 검증 → 사용자 확인 → 다음. 우선순위는 SKILL.md §4 (P1→P5) 순서.
5. 한글로, 초보자도 따라 할 수 있게 짧게. 질문은 막힐 때만 1개(선택지).

**지켜야 할 것**: 권한은 DB(RLS)가 강제 · 서버 접근은 `server/`에서만 · 복사 방지는 모르면 막는 쪽 · 새 색·폰트 임의 추가 금지 · 공개 저장소(실제 원고·secret 키 금지).

**알려진 기준선**: zip으로 받은 상태에서는 테스트 3개 실패 + 2개 파일 로드 실패가 정상(샘플 파일명 깨짐, `supabase/` 없음). `tools.py check`가 자동 제외한다.
