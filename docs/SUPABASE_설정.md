# Supabase 설정 (6-A, 초보자용)  — schema v2

## 어떤 프로젝트에 설치할까
- **새 프로젝트를 만들 수 있으면**: 새로 만든다(원고가 다른 서비스와 완전히 분리되어 가장 안전).
- **무료 프로젝트 2개 한도에 걸렸으면**
  - (권장) 안 쓰는 프로젝트(테스트용 등)를 삭제하거나 일시정지한 뒤 새로 만든다.
  - 또는 **기존 프로젝트에 얹는다.** 뷰어는 전용 스키마 `viewer` 안에만 만들어지므로 기존 테이블·함수와 이름이 겹치지 않고, `auth.users`에 트리거도 달지 않는다. 기존 계정(로그인)도 그대로 쓸 수 있다.
- 기존 프로젝트에 얹을 때 주의: ① 프로젝트 전체 Auth 설정(가입 허용, 이메일 템플릿 등)은 기존 서비스와 공유되므로 바꾸지 않는다 ② `service_role` 키는 프로젝트 전체 권한이므로 더 조심한다 ③ 뷰어 권한이 없는 기존 계정으로 로그인하면 아무것도 보이지 않는 것이 정상이다.

## 순서
1. (새 프로젝트일 때만) supabase.com → **New project** → 이름 `novel-viewer`, 강한 DB 비밀번호(따로 보관), Region **Northeast Asia (Seoul)**, Free
2. **SQL Editor → New query** → `supabase/schema.sql`(v2.1) 전체를 붙여넣고 **Run** (한 번만. 두 번 실행하면 "already exists" 오류가 나는 게 정상)
   - 이미 이전 버전을 설치했다면 전체가 아니라 **아직 실행하지 않은 마이그레이션만** 번호 순서대로 실행(한 번씩): `002_bookmarks.sql`(북마크), `003_auto_register.sql`(정산 등 같은 프로젝트 계정 자동 등록)
3. **Project Settings → API**(Data API)에서 **Exposed schemas**에 `viewer`를 추가하고 저장
4. 계정 준비: 기존 계정이 있으면 그대로 사용. 없으면 **Authentication → Users → Add user → Create new user**(이메일·비밀번호, **Auto Confirm User** 체크)
5. 내 계정을 편집자로 지정(처음 1회, SQL Editor에서 이메일만 바꿔 실행)
   ```sql
   insert into viewer.profiles (id, email, name, role)
   select id, email, '편집자', 'editor' from auth.users where email = '내이메일@example.com';
   ```
6. 작가에게 뷰어 권한 부여 — 작가 계정이 먼저 있어야 한다(Authentication → Users에서 확인). **SQL Editor에서는 아래 insert를 쓴다**(작가 이메일·이름만 바꿔 실행, 여러 번 실행해도 안전).
   ```sql
   insert into viewer.profiles (id, email, name, role)
   select id, email, '작가이름', 'author' from auth.users where email = '작가이메일@example.com'
   on conflict (id) do nothing;
   ```
   확인: `select email, role from viewer.profiles;`
   (참고: `viewer.add_author()` 함수는 **앱에 로그인한 편집자 화면(6-C)** 용이다. SQL Editor는 로그인 상태가 아니라서 "편집자만 사용할 수 있습니다" 오류가 나는 것이 정상.)
7. 값 두 개 확인 → 6-B에서 사용
   - **Project URL**: `https://프로젝트ID.supabase.co`. 프로젝트ID는 브라우저 주소창 `supabase.com/dashboard/project/프로젝트ID`의 마지막 부분(또는 Project Settings → General → Reference ID)
   - **publishable key**(`sb_publishable_…`) 또는 `anon` 키: Project Settings → API Keys

## 보안
- URL과 anon(publishable) 키는 공개 저장소에 들어가도 되도록 설계됨(권한은 DB 규칙이 강제).
- `service_role`/secret 키, DB 비밀번호는 절대 저장소·채팅에 올리지 않는다.
- 운영 중 계정 추가·백업·문제 해결은 `운영매뉴얼.md`를 보세요.
- 설치를 되돌리려면(뷰어 데이터 전부 삭제): `drop schema viewer cascade;` 그리고 Storage의 `viewer-manuscripts` 버킷 삭제.
