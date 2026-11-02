# Supabase 설정 (6-A, 초보자용)  — schema v2

## 어떤 프로젝트에 설치할까
- **새 프로젝트를 만들 수 있으면**: 새로 만든다(원고가 다른 서비스와 완전히 분리되어 가장 안전).
- **무료 프로젝트 2개 한도에 걸렸으면**
  - (권장) 안 쓰는 프로젝트(테스트용 등)를 삭제하거나 일시정지한 뒤 새로 만든다.
  - 또는 **기존 프로젝트에 얹는다.** 뷰어는 전용 스키마 `viewer` 안에만 만들어지므로 기존 테이블·함수와 이름이 겹치지 않고, `auth.users`에 트리거도 달지 않는다. 기존 계정(로그인)도 그대로 쓸 수 있다.
- 기존 프로젝트에 얹을 때 주의: ① 프로젝트 전체 Auth 설정(가입 허용, 이메일 템플릿 등)은 기존 서비스와 공유되므로 바꾸지 않는다 ② `service_role` 키는 프로젝트 전체 권한이므로 더 조심한다 ③ 뷰어 권한이 없는 기존 계정으로 로그인하면 아무것도 보이지 않는 것이 정상이다.

## 순서
1. (새 프로젝트일 때만) supabase.com → **New project** → 이름 `novel-viewer`, 강한 DB 비밀번호(따로 보관), Region **Northeast Asia (Seoul)**, Free
2. **SQL Editor → New query** → `supabase/schema.sql` 전체를 붙여넣고 **Run** (한 번만. 두 번 실행하면 "already exists" 오류가 나는 게 정상)
3. **Project Settings → API**(Data API)에서 **Exposed schemas**에 `viewer`를 추가하고 저장
4. 계정 준비: 기존 계정이 있으면 그대로 사용. 없으면 **Authentication → Users → Add user → Create new user**(이메일·비밀번호, **Auto Confirm User** 체크)
5. 내 계정을 편집자로 지정(처음 1회, SQL Editor에서 이메일만 바꿔 실행)
   ```sql
   insert into viewer.profiles (id, email, name, role)
   select id, email, '편집자', 'editor' from auth.users where email = '내이메일@example.com';
   ```
6. 작가에게 뷰어 권한 부여(계정이 먼저 있어야 함. 6-C부터는 앱 화면에서 가능)
   ```sql
   select viewer.add_author('작가이메일@example.com', '작가이름');
   ```
7. **Project Settings → API**에서 `Project URL`과 `anon`(또는 publishable) 키 확인 → 6-B에서 사용

## 보안
- URL과 anon(publishable) 키는 공개 저장소에 들어가도 되도록 설계됨(권한은 DB 규칙이 강제).
- `service_role`/secret 키, DB 비밀번호는 절대 저장소·채팅에 올리지 않는다.
- 설치를 되돌리려면(뷰어 데이터 전부 삭제): `drop schema viewer cascade;` 그리고 Storage의 `viewer-manuscripts` 버킷 삭제.
