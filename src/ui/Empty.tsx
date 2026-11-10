import type { ReactNode } from 'react';
/** 빈 화면은 무엇을 하면 되는지 알려주는 안내 */
export default function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><h2>{title}</h2><p>{children}</p></div>;
}
