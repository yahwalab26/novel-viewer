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
| 6-A | 서버 설계: DB·권한 규칙(RLS)·검증 테스트, Supabase 준비 | - | 완료(프로젝트 설정·계정 등록 확인) |
| 6-B | 로그인(이메일/비밀번호)·역할 표시·화면 분기 | 0.6.0 | 완료 |
| 6-C | 편집자: 원고 서버 업로드·작가 배정·공유 ON/OFF 관리 | 0.7.0 | 구현 완료, 확인 대기 |
| 6-D | 작가: 배정 원고 열람·주석/이어읽기 동기화, 편집자의 주석 열람 | 0.8.0 | - |
| 7 | 서재 다듬기(검색·북마크)·PWA 설치 | 0.9.0 | - |
| 8 | HWP(구형) | 0.9.x | - |
| 9 | 배포·가이드 최종본, 첫 정식 운영 | 1.0.0 | - |

후순위 백로그: 여러 문단에 걸친 형광펜, 메모 공개 범위 선택, 글자수 통계, 고아 주석 처리 화면.

## 5-1. 버전 규칙
`CHANGELOG.md` 참조. `package.json`의 version만 수정하면 화면에 반영. 현재 0.7.0.

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
- 계정: 기존 Auth 계정 사용 가능. **SQL Editor에서는 `auth.uid()`가 없어 `add_author()`가 거부됨 → `viewer.profiles`에 직접 insert**(앱 화면 6-C에서는 `add_author` 사용). 첫 편집자는 SQL로 `viewer.profiles`에 role='editor' 등록.
- 검증: `test/rls.test.ts`(PGlite, 시나리오 13개). **스키마를 바꾸면 반드시 통과시킬 것.** 규칙을 일부러 깨는 변이 검사 7종을 모두 잡아내는 것까지 확인함. (초기(v1) 테스트는 select 판정 오류·테이블명 누락으로 일부 변이를 못 잡았고, v2에서 수정함 — 테스트 자체도 변이 검사로 점검할 것.)
- 한계: `allow_copy`(복사 허용)는 화면 수준 억제일 뿐, 열람 권한이 있는 작가가 기술적으로 본문을 가져가는 것은 막을 수 없음. 공유 OFF 시 작가는 본문·주석을 즉시 못 보지만 데이터는 보존(다시 ON하면 복구).
- 코드 연결 계획: `LibraryRepository`의 `RemoteRepository` 구현 추가. 로컬 `Annotation.start/end` ↔ DB `start_pos/end_pos` 매핑. 책 id는 로컬은 파일 해시, 서버는 uuid(+`file_hash`로 중복 방지).
- 설정 절차: `docs/SUPABASE_설정.md`.

## 6-2b. 로그인·역할별 화면 (6-B, 0.6.0)
- 흐름: `App.tsx`가 세션을 감시 → 로그인 안 됨=`Login` / 로그인됨=`viewer.profiles`에서 내 역할 조회(`server/api.ts` → `access.ts`로 판정) → editor=`Library`(기존 서재) / author=작가 홈(배정 원고 없음 안내, 열람은 6-D) / none=권한 없음 / schema-not-exposed=Exposed schemas 안내 / error=오류+다시 시도.
- 서버 접근은 전부 `server/api.ts` 한 곳. 뷰어 데이터는 `viewer` 스키마(`Accept-Profile: viewer` 헤더, 테스트로 검증).
- 설정값: `src/config.ts`(프로젝트 URL·publishable 키 — 공개 가능). **secret/service_role 키는 절대 넣지 않는다.**
- 주의: `onAuthStateChange` 콜백 안에서 직접 서버 호출 금지(교착) → `setTimeout`으로 분리. 같은 사용자의 토큰 갱신 통지는 무시(`uid` ref).
- 공용 기기: 로컬 서재(IndexedDB)는 기기·브라우저 단위로 남는다. 로그아웃해도 편집자가 등록한 로컬 원고는 그 브라우저에 남아 있음(서버 업로드 전환은 6-C).

## 6-2c. 편집자 서버 기능 (6-C, 0.7.0)
- 화면: `EditorHome`(탭) → `ServerLibrary`(목록·업로드·개정본·삭제·읽기) → `AssignPanel`(작가 배정·공유·복사허용·작가 추가). 로컬 서재(`Library`)는 "이 기기에서만" 탭으로 유지.
- 서버 접근 코드: `server/books.ts`(`createBooksApi` 원고·배정, `createRemoteRepo` 형광펜·이어읽기). 모든 권한은 DB(RLS)가 강제하고 코드는 순서·정리만 담당.
- 업로드 순서: 중복확인(file_hash) → `books` → `book_contents`(revision 1) → Storage `viewer-manuscripts/<bookId>/r<rev>.<형식>` → `source_path`. 중간 실패 시 만든 행·파일 정리.
- 개정본: revision+1 본문 저장 → `books.current_revision` 갱신. 이전 개정본 본문은 남김. 작가에게는 최신본만 보임. 형광펜은 `quote`로 위치 재탐색.
- 배정: `assign`은 on-conflict-do-nothing(기존 설정 유지), 변경은 해당 필드만 PATCH. 공유 OFF는 즉시 작가 접근 차단(주석 데이터 보존).
- Storage 키는 영문·숫자만(`<uuid>/r1.hwpx`). 한글 파일명은 키에 쓰지 않는다(Supabase 제한).
- Viewer는 `AnnotationStore` 인터페이스만 의존 → 로컬/서버 저장소를 교체 가능. 서버 저장 실패는 현재 콘솔에만 기록(재시도·오프라인 큐는 후순위).
- 한계: 아주 큰 본문(수 MB 이상)은 요청 크기 제한에 걸릴 수 있음("파일이 너무 큽니다" 안내). 필요 시 회차 단위 분할 저장으로 개선.

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
