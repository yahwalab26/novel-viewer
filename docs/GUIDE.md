# 웹소설 전용 뷰어 — 인수인계 가이드 (v0 / 1단계)

## 1. 목적
EPUB·DOCX·HWPX·HWP 파일을 등록해 읽는 웹소설 전용 뷰어. 모바일·PC 대응. 사용자: 작가/편집자(미출간 원고 검수) + 독자(출간작 열람).

## 2. 확정 결정
| 항목 | 결정 |
|---|---|
| 형태 | PWA (React + TypeScript + Vite) |
| 처리 방식 | 로컬 우선(IndexedDB), 서버는 후순위 확장 |
| 구조 | 모든 포맷 → 공통 모델(`src/core/model.ts`) → 단일 뷰어 |
| 네이티브 앱 | 필요 시 Capacitor (후순위) |

## 3. 아키텍처
```
파일 → [Parser(포맷별)] → Book(공통모델) → [LibraryRepository] → [Viewer UI]
```
- **Parser**: 포맷별 1개 모듈. UI·저장소를 모른다. 단위 테스트 필수.
- **LibraryRepository**: 저장 추상화. 지금 `LocalRepository`(IndexedDB, Dexie). 서버 확장 시 `RemoteRepository`만 추가, UI 수정 없음.
- **Viewer**: Book만 렌더링. 포맷을 모른다.

## 4. 핵심 규칙 (유지보수)
1. 포맷 추가 = `Parser` 구현 + 등록 1줄. 뷰어 수정 금지.
2. 원본 파일(Blob)과 파싱 결과를 함께 저장. `parserVersion`이 올라가면 원본으로 재파싱.
3. Book id = 파일 해시. 같은 파일 중복 등록 방지.
4. 회차 분할 우선순위: ① 문서 자체 목차/제목 스타일 → ② 패턴(`N화`, `제N화`, `EP.N`) → ③ 사용자 수동 조정.
5. 웹소설은 텍스트 중심. 표·이미지는 후순위, 못 읽어도 텍스트는 반드시 보존.
6. 글자수는 공백 포함/제외 둘 다 계산해 `charCount`로 보관 (작가용).

## 5. 로드맵 (확정 순서)
| 단계 | 내용 | 버전 | 상태 |
|---|---|---|---|
| 1 | 요구 확정·데이터 모델·가이드 v0 | 0.1.0 | 완료 |
| 2 | EPUB/DOCX 파서 + 회차 분할 | 0.2.0 | 완료 |
| 3 | 뷰어 화면 (서재·읽기·설정·목차, 로컬) | 0.3.x | 완료 |
| 4 | 형광펜·메모 (로컬) | 0.4.x | 완료 |
| 5 | HWPX 파서 | 0.5.0 | 구현 완료, 확인 대기 |
| 6-A | 서버 설계: DB·권한 규칙(RLS)·검증 테스트, Supabase 준비 | - | SQL 완료, 사용자 설정 대기 |
| 6-B | 로그인(이메일/비밀번호)·역할 표시·화면 분기 | 0.6.0 | - |
| 6-C | 편집자: 원고 서버 업로드·작가 배정·공유 ON/OFF 관리 | 0.7.0 | - |
| 6-D | 작가: 배정 원고 열람·주석/이어읽기 동기화, 편집자의 주석 열람 | 0.8.0 | - |
| 7 | 서재 다듬기(검색·북마크)·PWA 설치 | 0.9.0 | - |
| 8 | HWP(구형) | 0.9.x | - |
| 9 | 배포·가이드 최종본, 첫 정식 운영 | 1.0.0 | - |

후순위 백로그: 여러 문단에 걸친 형광펜, 메모 공개 범위 선택, 글자수 통계, 고아 주석 처리 화면.

## 5-1. 버전 규칙
`CHANGELOG.md` 참조. `package.json`의 version만 수정하면 화면에 반영. 현재 0.5.0.

## 6. 작업 로그
- 1단계: 데이터 모델 초안, 가이드 v0 작성.
- 2단계: tooling(TS+vitest), `parsers/epub.ts`, `parsers/docx.ts`, `core/chapters.ts`, `core/settings.ts`(뷰어 설정 전체), 권한 모델(`Role`, `Assignment`). 테스트 3개 통과.
  - 파서 입력은 `ArrayBuffer` (UI는 `file.arrayBuffer()`로 전달). 사용: `parseFile(file)`.
  - 실행: `npm install && npm test` (일부 클라우드 폴더는 symlink 불가 → 로컬 디스크에서 실행)

- 3.5단계: GitHub Pages 자동 배포(`docs/deploy.yml.txt`), 샘플 원고(`samples/`), 사용자 도메인 연결 안내.
- 4단계: 형광펜 4색 + 메모. `viewer/anchor.ts`(위치 계산·개정 재탐색, 테스트 포함), `viewer/AnnotationUI.tsx`(선택 바·메모 시트·메모 목록). 저장은 로컬 IndexedDB(`ann:<bookId>`), `authorId='local'`.
  - 사용: 글자를 길게 눌러(PC는 드래그) 선택 → 색 선택 또는 메모. 형광펜 탭 → 수정/삭제. 상단 '메모' → 전체 목록, 탭하면 해당 위치로 이동. 설정의 '형광펜 보기'로 숨김, '주석 팝업'은 탭 시 메모창 열림 여부.
  - 제한: 한 문단 안에서만 선택 가능(여러 문단 선택은 미지원). 원고 개정 시 원문(quote)으로 위치를 다시 찾고, 못 찾으면 목록에서만 보임(고아 처리 UI는 6단계).
  - 6단계에서 `RemoteRepository`가 같은 `Annotation`을 서버에 저장 → 편집자 열람은 RLS(편집자는 전체 읽기, 작가는 본인 것만 쓰기).

- 4.1: PC 드래그 선택 인식 오류 수정(`viewer/selection.ts`, 테스트 포함), 버전 표시 추가.

- 5단계(0.5.0): `parsers/hwpx.ts`. 구조 메모: `Contents/content.hpf`(spine·제목·저자) → `Contents/section*.xml`(본문), `header.xml`(스타일 이름). 문단 `hp:p>hp:run>hp:t`, 표·글상자 속 문단은 이어 붙임, `hp:ctrl`(머리말·각주)·이미지 무시. 개요/제목 스타일이면서 40자 이하면 소제목. 회차 제목 패턴에 `작품명 – 01` 추가.
  - 주의: **실제 원고는 저장소·샘플에 넣지 않는다**(공개 저장소). 테스트는 `scripts/make-samples.mjs`가 만드는 가상 파일 사용.
  - 알려진 한계: 각주·머리말 텍스트, 이미지, 수식은 표시하지 않음. 암호가 걸린 HWPX는 오류 안내.

## 6-1. 뷰어 설정 명세 (참고 화면 기준, 3단계 구현)
`src/core/settings.ts` 참조. 화면: 배경 7색, 밝기, 글꼴, 글자크기(1~10), 줄간격, 문단간격, 문단너비(1~5), 문단정렬, 형광펜. 읽기: 터치영역, 상하터치, 주석팝업, 하단정보, 넘김효과, 가로 두쪽보기, 스크롤보기, 밝기제스처, 회전고정, 화면켜짐. 스크롤 모드에서는 터치/넘김효과/하단정보/밝기제스처/두쪽보기 비활성.

## 6-2. 역할과 권한 (확정)
- **editor(편집자)**: 모든 작가 원고 등록·삭제·개정본 업로드, 작가별 배정, 공유 ON/OFF, 복사 허용 여부 설정.
- **author(작가)**: 본인에게 배정(+공유 ON)된 원고만 열람. 형광펜·메모 가능. 업로드/삭제 불가.
- 편집자-작가 구조는 다계정이라 **서버(계정·권한)가 필수**. 권한은 DB(RLS)에서 강제하고 화면은 따라가기만 한다.
- 형광펜/메모는 `Annotation`(문단 위치 + 원문 quote). 원고 개정 시 quote로 위치를 재탐색.

## 6-2a. 서버 설계 (6-A, schema v2)
- 스택: Supabase(무료) = Auth(이메일/비밀번호) + Postgres(RLS) + Storage. 프론트는 GitHub Pages 그대로.
- **전용 스키마 `viewer`**: 모든 테이블·함수가 `viewer` 안에 있어 기존 프로젝트에 얹어도 충돌 없음. `auth.users` 트리거 없음(뷰어 권한은 `viewer.profiles`에 있는 사람만). API 노출을 위해 대시보드 *Exposed schemas*에 `viewer` 추가 필요. 클라이언트는 `createClient(url, key, { db: { schema: 'viewer' } })`.
- 스키마: `supabase/schema.sql`. 테이블 `profiles`(역할), `books`, `book_contents`(파싱 JSON, revision), `assignments`(배정·공유 ON/OFF), `annotations`, `reading_states`, Storage 버킷 `viewer-manuscripts`(원본, 편집자 전용·비공개). 함수 `is_editor()`, `can_read_book()`, `add_author(email, name)`(편집자만, 기존 계정에 작가 권한 부여).
- 권한(전부 DB에서 강제): 로그인 전=스키마 접근권 자체가 없음 / 작가=배정+공유ON 원고만, 본인 주석만 작성·수정·삭제 / 편집자=전체 관리, 모든 작가 주석 열람(수정 불가) / 역할(role) 변경은 SQL로만.
- 계정: 기존 Auth 계정 사용 가능. 첫 편집자는 SQL로 `viewer.profiles`에 role='editor' 등록.
- 검증: `test/rls.test.ts`(PGlite, 시나리오 13개). **스키마를 바꾸면 반드시 통과시킬 것.** 규칙을 일부러 깨는 변이 검사 7종을 모두 잡아내는 것까지 확인함. (초기(v1) 테스트는 select 판정 오류·테이블명 누락으로 일부 변이를 못 잡았고, v2에서 수정함 — 테스트 자체도 변이 검사로 점검할 것.)
- 한계: `allow_copy`(복사 허용)는 화면 수준 억제일 뿐, 열람 권한이 있는 작가가 기술적으로 본문을 가져가는 것은 막을 수 없음. 공유 OFF 시 작가는 본문·주석을 즉시 못 보지만 데이터는 보존(다시 ON하면 복구).
- 코드 연결 계획: `LibraryRepository`의 `RemoteRepository` 구현 추가. 로컬 `Annotation.start/end` ↔ DB `start_pos/end_pos` 매핑. 책 id는 로컬은 파일 해시, 서버는 uuid(+`file_hash`로 중복 방지).
- 설정 절차: `docs/SUPABASE_설정.md`.

## 6-3. 디바이스 대응 원칙
- 반응형 3구간: 모바일(<600px) 1단, 태블릿(600~1024px) 가로 시 두쪽보기, PC(>1024px) 본문 중앙 + 좌측 목차 패널.
- 입력: 터치(탭 영역·스와이프), 마우스(클릭·휠), 키보드(←→, Space, PgUp/PgDn).
- iOS/안드로이드 safe-area, 화면 회전, 시스템 다크모드 연동. PWA로 설치.
- 지원 브라우저: iOS Safari 16+, Chrome, Edge, Samsung Internet, Firefox 최신 2개 버전.

## 6-4. 배포·확인 방법 (GitHub Pages, 설치 없이 확인)
- 호스팅: GitHub Pages(무료, 공개 저장소). 서버/DB 단계(6단계)에서 Supabase(무료 플랜) 추가.
- 자동 배포: `main` 브랜치에 파일을 올리면 GitHub Actions가 빌드 → Pages 반영(1~2분). 워크플로 사본: `docs/deploy.yml.txt`.
- 주소: `https://<GitHub아이디>.github.io/<저장소이름>/`
- 원고는 서버에 올라가지 않고 각자 브라우저(IndexedDB)에만 저장됨. 저장소에 원고 파일을 올리지 말 것. 테스트용은 `samples/`의 가짜 원고만.
- 커스텀 도메인: 기존 홈페이지/정산 사이트가 쓰는 `yahwalab.xyz`와 충돌하지 않도록 **서브도메인**(예: `viewer.yahwalab.xyz`) 사용. DNS에 `CNAME viewer → <GitHub아이디>.github.io` 추가 후 저장소 Settings → Pages → Custom domain 입력, HTTPS 강제 체크. 주소(origin)가 바뀌면 브라우저 저장소(IndexedDB)가 분리되므로 로컬 등록 원고는 새 주소에서 다시 등록해야 함.
- Vite `base: './'` 설정으로 저장소 이름이 붙는 주소에서도 동작.
- Supabase 키 주의: 공개 저장소에는 `anon` 키만 사용 가능(RLS 필수). `service_role` 키는 절대 커밋 금지.

## 7. 알려진 이슈/리스크
- HWP(구형 바이너리)는 브라우저 파싱이 어려움 → 6단계에서 방식 확정.
- 모바일 브라우저 저장 용량 제한 → 대용량 파일 경고 필요.
