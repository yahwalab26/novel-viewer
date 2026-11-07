# 이 저장소를 맡은 Claude에게

웹소설 뷰어(React+TS+Vite PWA / Supabase `viewer` 스키마 / GitHub Pages). **먼저 `ai/novel-viewer-dev/SKILL.md`를 읽고 그 규칙·`scripts/`를 그대로 쓰세요.**
- 저장소를 통째로 읽지 말고 `python3 ai/novel-viewer-dev/scripts/codemap.py` → `g.py` 로 필요한 구간만.
- 한 번에 한 항목(구현→검증→사용자 확인→다음). 우선순위: ① 필수(권한·개인정보·배포 안전) > ② 빨리 끝나는 것 > ③ 나중.
- 검증: `python3 ai/novel-viewer-dev/scripts/check.py --only <이름>` (마지막에 `--build`). 바뀐 파일만 `pack.py`로 zip.
- 공개 저장소: 실제 원고·작품명·이메일·secret 키 금지. 한글로 답하고 초보자도 따라 할 수 있게 단계별로 안내.
- 상세: `docs/GUIDE.md`(구조), `docs/운영매뉴얼.md`(운영), `ai/novel-viewer-dev/references/`(백로그·함정·플레이북).
