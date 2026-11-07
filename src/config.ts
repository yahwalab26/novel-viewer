// 공개 가능한 값만 둔다. (URL, publishable/anon 키는 브라우저에 노출되어도 안전하도록 DB 권한 규칙(RLS)이 보호)
// ⚠ secret / service_role 키, DB 비밀번호는 절대 여기에 넣지 말 것.
export const SUPABASE_URL = 'https://wddixxdrndgvjgicwunu.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_fIrxIqOmX_-BFpSELdmvXQ_kkYSkaCx';
// 계정(이메일·비밀번호)은 정산 사이트와 같은 Supabase 계정이다. 비밀번호 변경·분실 처리는 정산 사이트에서 한다.
export const SETTLE_URL = 'https://settle.yahwalab.xyz';
