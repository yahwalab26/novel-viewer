# Supabase 설정 (6-A, 초보자용)

목표: 무료 Supabase 프로젝트를 만들고, DB 구조/권한 규칙을 넣고, 편집자·작가 계정을 만든다.

1. supabase.com 가입 (GitHub 계정으로 로그인 가능)
2. **New project** → 이름 `novel-viewer`, Database Password(강한 비밀번호, 따로 보관), Region **Northeast Asia (Seoul)**, Free 플랜 → 생성(약 2분)
3. 왼쪽 **SQL Editor → New query** → 저장소의 `supabase/schema.sql` 전체 복사/붙여넣기 → **Run** → `Success` 확인
4. **Table Editor**에서 profiles, books, book_contents, assignments, annotations, reading_states 6개 확인
5. 가입 막기: **Authentication → Sign In / Providers**(또는 Settings)에서 *Allow new users to sign up* 끄기 (계정은 편집자가 직접 만든다)
6. 편집자 계정: **Authentication → Users → Add user → Create new user** → 이메일/비밀번호, **Auto Confirm User** 체크
7. 편집자 지정: SQL Editor에서 `update public.profiles set role = 'editor' where email = '내이메일';` → Run
8. 작가 계정: 6번과 동일(역할 지정 불필요, 기본 author)
9. **Project Settings → API**에서 `Project URL`과 `anon`(또는 publishable) 키 확인 → 6-B에서 사용

주의: `service_role`/secret 키, DB 비밀번호는 절대 저장소·채팅에 올리지 않는다. URL과 anon(publishable) 키는 공개되어도 안전하도록(RLS) 설계됨.
