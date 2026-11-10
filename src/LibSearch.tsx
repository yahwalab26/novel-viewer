/** 서재 목록 위 검색창. 작품이 5개 이상일 때만 보인다. */
export default function LibSearch({ count, value, onChange }: { count: number; value: string; onChange: (v: string) => void }) {
  if (count < 5 && !value) return null;
  return <input className="lb-search" type="search" placeholder="작품명이나 작가명으로 찾기" aria-label="원고 검색" value={value} onChange={e => onChange(e.target.value)} />;
}
