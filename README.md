# 웹소설 뷰어

웹소설 원고(EPUB·DOCX·HWPX·HWP)를 등록해 읽는 전용 뷰어입니다. 모바일·PC 브라우저에서 동작하고 홈 화면에 앱처럼 설치할 수 있습니다.

- **편집자**: 원고를 서버에 올리고, 작가별로 배정·공유를 켜고 끄며, 작가가 남긴 형광펜·메모를 봅니다.
- **작가**: 배정된 원고만 읽고, 형광펜·메모·북마크를 남깁니다.
- **기술**: React + TypeScript + Vite(PWA) / Supabase(로그인·DB·파일 저장) / GitHub Pages(호스팅, 무료)

> 이 저장소는 공개입니다. **실제 원고·비밀 키를 절대 올리지 마세요.** (`samples/`는 모두 가상 파일입니다.)

## 문서
| 문서 | 대상 | 내용 |
|---|---|---|
| [`docs/운영매뉴얼.md`](docs/운영매뉴얼.md) | 편집자(비개발자) | 계정 추가, 원고 올리기·배정·공유, 비밀번호, 백업, 문제 해결 |
| [`docs/GUIDE.md`](docs/GUIDE.md) | 개발·유지보수 담당 | 구조, 핵심 규칙, 기능별 코드 위치, 배포, 보안, 한계 |
| [`docs/SUPABASE_설정.md`](docs/SUPABASE_설정.md) | 설치 담당 | Supabase 프로젝트 준비 순서 |
| [`docs/HISTORY.md`](docs/HISTORY.md) | 유지보수 담당 | 단계별 설계 결정 기록 |
| [`CHANGELOG.md`](CHANGELOG.md) | 모두 | 버전별 변경 내용 |
| [`CLAUDE.md`](CLAUDE.md) · [`ai/novel-viewer-dev/`](ai/novel-viewer-dev/SKILL.md) | AI 작업자(Claude) | 적은 토큰으로 이어서 작업하는 규칙·스크립트·시작 프롬프트 |

## 개발 빠른 시작
```bash
npm ci              # 의존성 설치 (잠금 파일 기준)
npm run dev         # 개발 서버
npm run typecheck   # 타입 검사
npm test            # 테스트 전체
npm run build       # 배포용 빌드 → dist/
```
Node 20 이상. 일부 클라우드 동기화 폴더에서는 설치가 실패하니(`symlink` 오류) 일반 디스크에서 작업하세요.

## 라이선스
별도 라이선스를 지정하지 않았으므로 모든 권리는 저작권자에게 있습니다. 공개 범위는 저장소 소유자가 정합니다.
