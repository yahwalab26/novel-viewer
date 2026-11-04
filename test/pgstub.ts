// Supabase 환경 흉내(역할·auth·storage 스텁). rls/migrations 테스트가 공유한다.
export const STUB = `
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table public.profiles (id uuid primary key, role text);  -- 기존 프로젝트에 이미 있는 같은 이름 테이블(충돌 확인용)
    create table public.books (id int);
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (bucket_id text, name text); alter table storage.objects enable row level security;
    grant usage on schema auth, storage, public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;   -- Supabase 기본 설정 흉내
    grant select, insert, update, delete on storage.objects to authenticated;
  `;
