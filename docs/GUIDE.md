# 웹소설 뷰어 — 개발·유지보수 가이드 (v0.11.0 · 정식 1.0.0은 디자인 개편·계정 통합 후 배포)

처음 맡는 개발자가 **이 문서만으로 구조를 파악하고 안전하게 수정·배포**할 수 있도록 정리했습니다. 비개발자 운영은 `운영매뉴얼.md`, 설계 결정의 배경은 `HISTORY.md`를 보세요.

## 1. 한눈에 보기
```
브라우저(React PWA, GitHub Pages)
   │  파일 선택 → [파서] → Book(공통 모델) → [뷰어]
   │                                  └ 저장소 인터페이스 ─┬ 로컬(IndexedDB): "이 기기에서만" 서재
   │                                                        └ 서버(Supabase): 서버 원고·형광펜·북마크·이어읽기
   └─ 로그인(Supabase Auth) → 역할(editor/author) → 화면 분기
Supabase: Auth(이메일/비밀번호) + Postgres(스키마 `viewer`, RLS로 권한 강제) + Storage(`viewer-manuscripts`, 원본 파일)
```
- 서버는 **정적 호스팅 + Supabase**뿐입니다(직접 운영하는 서버 없음).
- **권한은 화면이 아니라 DB(RLS)가 강제**합니다. 화면 코드는 편의일 뿐, 보안 경계가 아닙니다.

## 2. 핵심 설계 규칙 (깨지 말 것)
1. **모든 포맷 → 공통 모델 `Book`(`core/model.ts`) → 뷰어 하나.** 포맷 추가 = `Parser` 구현 1개 + `parsers/index.ts` 등록 1줄. 뷰어는 포맷을 모른다.
2. 파서는 UI·저장소를 모르는 **순수 모듈**(입력 `ArrayBuffer`). 반드시 테스트를 함께 만든다.
3. 뷰어는 저장소 **인터페이스**(`AnnotationStore`, `BookmarkStore`)만 의존한다. 로컬/서버 교체 가능.
4. 서버 접근은 `server/api.ts`·`server/books.ts` 한 곳에서만. 모든 요청은 `viewer` 스키마(`Accept-Profile: viewer`)로 간다.
5. DB 변경은 **마이그레이션 파일 추가 → `schema.sql` 합본 갱신 → 테스트**(8장). `schema.sql`을 따로 손으로 고치지 않는다.
6. 뷰어 좌우 여백은 CSS 변수 `--padx`/`--padx-extra`로만 바꾼다(페이지 모드 쪽 계산이 computed padding을 읽음).
7. 서비스 워커는 **같은 출처 GET만** 처리한다. Supabase(다른 출처)는 건드리지 않아 서버 원고가 기기에 캐시되지 않는다.
8. 저장소는 공개다. 실제 원고·secret 키·개인정보를 넣지 않는다(`samples/`는 가상 파일).

## 3. 폴더 구조
```
src/
  main.tsx · App.tsx           진입점 / 로그인 상태·역할별 화면 분기
  Auth.tsx                     로그인·계정 바·비밀번호 변경·안내 화면
  EditorHome.tsx               편집자 홈(탭: 서버 원고 | 이 기기에서만)
  ServerLibrary.tsx · AssignPanel.tsx   서버 원고 목록·업로드·개정본·삭제 / 작가 배정·공유·복사허용
  AuthorHome.tsx               작가 홈(배정된 원고 목록·읽기)
  Library.tsx                  로컬 서재(IndexedDB)
  LibSearch.tsx · Install.tsx · standalone.ts · ErrorBoundary.tsx
  config.ts                    Supabase URL·publishable 키(공개 가능한 값만)
  core/    model.ts(데이터 모델·인터페이스) chapters.ts(회차 분할) search.ts(검색) settings.ts(뷰어 설정) hash.ts
  parsers/ epub.ts docx.ts hwpx.ts hwp.ts index.ts(등록·확장자 라우팅)
  server/  api.ts(클라이언트·로그인) access.ts(역할 판정·오류 문구) books.ts(원고·배정·형광펜·북마크)
  store/   repo.ts(로컬 저장소) useSettings.ts
  viewer/  Viewer.tsx(읽기 화면 본체) SettingsPanel.tsx NavPanel.tsx(목차·북마크·검색)
           AnnotationUI.tsx(형광펜·메모) anchor.ts(위치 재탐색) selection.ts(선택 해석) protect.ts(복사 방지·필터) theme.ts
public/    manifest.webmanifest · sw.js · icons/
supabase/  schema.sql(합본) · migrations/001_init.sql · 002_bookmarks.sql
scripts/   make-samples.mjs(샘플 생성) · hwp-builder.mjs(가상 HWP 생성기)
test/      파서·뷰어·서버·DB 권한 테스트 (13개 파일, 99개)
```

## 4. 기능 → 코드 위치
| 기능 | 위치 |
|---|---|
| 파일 → 회차·문단 | `parsers/*`, 회차 분할 `core/chapters.ts`(패턴: `N화`·`제N화`·`EP.N`·`작품명 – 01`·프롤로그 등) |
| 읽기(스크롤/페이지), 이어읽기 저장 | `viewer/Viewer.tsx` |
| 설정(배경 7색·글꼴·간격·터치 등) | `core/settings.ts`, `viewer/SettingsPanel.tsx`, `viewer/theme.ts` |
| 형광펜·메모 | `viewer/selection.ts`(선택→문단 위치), `anchor.ts`(개정 시 문장으로 재탐색), `AnnotationUI.tsx` |
| 편집자가 작가 메모 보기 | `Viewer`의 `meId`·`names`, `protect.ts`의 `isMine`/`filterAnns` |
| 북마크·본문 검색·서재 검색 | `NavPanel.tsx`, `core/search.ts`, `LibSearch.tsx` |
| 복사 방지(작가) | `viewer/protect.ts`(`installProtection`) + 인쇄 CSS |
| 로그인·역할 | `Auth.tsx`, `App.tsx`, `server/api.ts`, `server/access.ts` |
| 원고 업로드·개정·삭제·배정 | `server/books.ts`(순서와 실패 시 정리 포함) |
| PWA·설치 | `public/manifest.webmanifest`, `public/sw.js`, `Install.tsx`, `standalone.ts` |

## 5. 데이터 모델 요약
- 로컬: IndexedDB 키 `book:` `meta:` `src:`(원본) `state:` `ann:` `bm:` + localStorage `nv.settings`.
- 서버(`viewer` 스키마): `profiles`(역할) · `books` · `book_contents`(회차 JSON, `revision`) · `assignments`(배정·`enabled`·`allow_copy`) · `annotations` · `bookmarks` · `reading_states`. Storage `viewer-manuscripts/<bookId>/r<revision>.<형식>`(키는 영문·숫자만).
- 계정 통합: 뷰어와 정산 사이트는 **같은 Supabase 프로젝트(같은 `auth.users`)** 를 쓴다. 정산 계정으로 뷰어에 처음 로그인하면 `server/api.ts`의 `loadAccess`가 `viewer.ensure_profile()`을 불러 **작가로만** 자동 등록(편집자 자동 부여 없음, 배정 전엔 원고 접근 불가, `viewer.app_settings.auto_register`로 중단 가능). 정산의 `public.*` 표는 건드리지 않는다.
- 권한 요약: anon=접근 불가 / author=배정+공유ON 원고만, 본인 주석·북마크·이어읽기만 쓰기 / editor=전체 관리, 모든 작가 **주석 열람만**(수정·삭제 불가), 남의 북마크는 못 봄 / 역할 변경은 SQL로만.

## 6. 배포
- **호스팅**: GitHub Pages(공개 저장소 필요). `main`에 올리면 GitHub Actions가 `npm ci → 타입검사 → 테스트 → 빌드 → 배포`. **테스트가 실패하면 배포되지 않는다.** 워크플로 사본: `docs/deploy.yml.txt`(실제 파일은 `.github/workflows/deploy.yml`).
- **주소**: `https://<아이디>.github.io/<저장소>/` 또는 사용자 도메인 `yahwalab.xyz`의 서브도메인(DNS `CNAME → <아이디>.github.io`, 저장소 Settings → Pages → Custom domain, HTTPS 강제). 모든 경로가 상대경로(`base './'`)라 어느 주소에서도 동작.
- **주의**: 주소(origin)가 바뀌면 브라우저 저장소(로컬 서재)가 분리된다. 서버 원고는 영향 없음.
- **Supabase**: `docs/SUPABASE_설정.md`. 기존 프로젝트에 얹을 수 있게 전용 스키마 `viewer` 사용. 대시보드 **Exposed schemas**에 `viewer` 등록 필수. 클라이언트는 `createClient(url, key, { db: { schema: 'viewer' } })`.
- **버전**: `package.json`의 `version` 한 곳(화면에 자동 표시). `MAJOR.MINOR.PATCH` — 버그수정=PATCH, 기능=MINOR, 호환 깨짐=MAJOR. 변경은 `CHANGELOG.md`에 기록.

## 7. 개발 워크플로
1. `npm ci` → `npm run dev`. 서비스 워커는 운영 빌드(`npm run build`)에서만 등록된다.
2. 변경 → `npm run typecheck && npm test` 통과 → 올리기(바뀐 파일만 덮어써도 됨).
3. **파서 추가**: `parsers/<형식>.ts`에서 `Parser` 구현 → `parsers/index.ts` 등록 → 가상 샘플 생성기(`scripts/`)와 테스트 추가 → 실제 파일이 있으면 정답 도구와 대조(HWP는 `hwp5txt`로 대조한 방법이 `HISTORY.md`에 있음).
4. **DB 변경**: `supabase/migrations/NNN_설명.sql` 추가 → `schema.sql`을 001부터 순서대로 이어 붙여 갱신 → `test/migrations.test.ts`(새 설치=업그레이드 결과 일치)와 `test/rls.test.ts`(권한 시나리오) 통과 → 운영 DB에는 새 마이그레이션만 한 번 실행. **RLS를 바꾸면 규칙을 일부러 깨 보는 변이 검사도 해 볼 것**(테스트 자체가 구멍 나지 않았는지 확인).
5. **의존성 추가**는 최소화(현재 런타임: react, react-dom, @supabase/supabase-js, jszip, idb-keyval, cfb, fflate). `npm audit --omit=dev` 확인.

## 8. 테스트 전략
- 파서: 가상 샘플(`samples/`) + 단위 테스트. HWP/HWPX는 별도 실제 파일 대조로도 검증.
- 서버 연동: 가짜 fetch 서버로 **요청 순서·헤더·본문**을 검증(`test/books.test.ts`). 실제 서버와 다를 수 있으니 배포 후 스모크 테스트(9장)를 한다.
- DB 권한: PGlite(가짜 Postgres)에 Supabase 환경을 흉내내 시나리오 실행(`test/rls.test.ts`, `pgstub.ts`).
- 화면: jsdom + react-dom(`login.test.tsx`, `author.test.tsx`). **실제 브라우저에서의 모양·터치 동작은 자동 테스트가 못 잡으므로 배포 후 폰/PC로 직접 확인**한다.

## 9. 배포 후 스모크 테스트 (릴리스마다)
1. 편집자 로그인 → 서버 원고 업로드(HWPX/DOCX/EPUB/HWP 각 1개) → 읽기 → 형광펜·북마크 → 새로고침 후 유지
2. 작가 배정 → 작가 계정 로그인 → 목록·읽기 → 복사 방지 확인 → 형광펜 남기기
3. 편집자로 돌아와 작가 형광펜이 점선으로 보이는지 → 공유 OFF → 작가 쪽에서 사라지는지 → ON 복구
4. 폰: 로그인(자동완성 포함), 설치 앱 실행(전체화면), 페이지/스크롤 모드, 검색·북마크
5. 하단 버전 표기가 기대한 값인지

## 10. 보안 체크리스트
- [ ] `src/config.ts`에는 URL·publishable 키만 있다. `service_role`/secret 키·DB 비밀번호는 저장소·채팅 어디에도 없다.
- [ ] Supabase **Database → Advisors(Security)** 경고 확인. 새 테이블은 반드시 RLS 활성화 + 정책.
- [ ] 이 프로젝트를 다른 서비스와 공유한다면 Auth 설정(가입 허용·메일 템플릿)을 함부로 바꾸지 않는다.
- [ ] 분실·유출 의심 시: Supabase에서 키 재발급, 해당 계정 비밀번호 재설정, 공유 OFF.
- [ ] 공용 PC 주의: "이 기기에서만" 서재는 그 브라우저에 남는다.
- 알려둘 점: 화면 렌더링은 React 텍스트 노드만 사용하고 `innerHTML`류를 쓰지 않는다(원고 내용으로 인한 스크립트 삽입 위험 낮음). CSP는 설정하지 않았다(GitHub Pages는 헤더 지정 불가, meta CSP는 실제 브라우저 검증 없이 넣으면 화면이 깨질 위험이 있어 보류).

## 11. 알려진 한계
- **복사 방지는 억제 수준**: 화면 캡처·개발자도구·수동 입력은 막을 수 없다. 읽을 권한이 있는 사람이 본문을 가져가는 것은 기술적으로 막을 수 없다.
- 서버 원고는 **온라인에서만** 열린다(원고를 기기에 캐시하지 않는 것이 의도).
- 서버 저장(형광펜·이어읽기) 실패 시 재시도 큐가 없다(콘솔 기록만, 북마크는 토스트로 알림).
- 형광펜은 **한 문단 안**에서만. 여러 문단 선택은 첫 문단만 적용.
- 아주 큰 본문은 요청 크기 제한에 걸릴 수 있다(회차 단위 분할 저장으로 개선 가능).
- 비밀번호 **분실 시 재설정 화면 없음**(대시보드에서 처리). 이메일 변경 기능 없음.
- HWP: 배포용·암호·DRM 문서와 3.0/97 이전 형식 미지원. 머리말·각주·이미지 무시. 표는 구조 없이 문단으로 이어 붙임. HWPX: 각주·머리말·이미지 무시.
- 무료 플랜 제약: 오래 미사용 시 프로젝트 일시정지, 자동 백업 제한(`운영매뉴얼.md` 5장).
- 로컬 서재와 서버 서재는 별개다(자동 이전 없음).

## 12. 백로그 (우선순위 제안)
1. 로그인 전 **비밀번호 재설정** 화면(메일 링크 처리)
2. **편집자용 메모 내보내기**(CSV/Excel) · 원본 내려받기(백업·이관)
3. 여러 문단에 걸친 형광펜
4. 검색 결과 단어 강조 표시
5. 서버 저장 실패 시 재시도 큐 / 오프라인 임시 저장
6. 큰 원고용 회차 단위 저장·지연 로딩
7. 작가 계정 앱 내 초대(현재는 대시보드에서 계정 생성)
8. 설정 동기화(기기 간), 다크모드 자동 연동
