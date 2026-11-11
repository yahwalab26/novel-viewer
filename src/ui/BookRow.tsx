import type { ReactNode } from 'react';

export interface BookRowProps {
  title: string; byline?: string; chips?: string[]; facts: string[];
  progress?: { ratio: number; label: string; done?: boolean } | null; status?: { on: boolean; text: string };
  onOpen: () => void; actions?: ReactNode;
}
/** 원고 한 줄. 본문 영역 전체가 '읽기' 버튼이고, 관리 동작(actions)은 그 바깥에 둔다(버튼 안에 버튼 금지). */
export default function BookRow(p: BookRowProps) {
  return (
    <li className="bk">
      <button type="button" className="bk-main" onClick={p.onOpen}>
        <span className="bk-title">{p.title}</span>
        {p.byline && <span className="bk-by">{p.byline}</span>}
        <span className="bk-facts">{p.chips?.map(c => <span key={c} className="chip">{c}</span>)}{p.facts.map(f => <span key={f}>{f}</span>)}</span>
        {p.progress && <>
          <span className="bk-prog" role="img" aria-label={`${p.progress.label}, ${Math.round(p.progress.ratio * 100)}%`}><i style={{ width: `${p.progress.ratio * 100}%` }} /></span>
          <span className="bk-readrow"><span>{p.progress.label}</span><b>{p.progress.done ? '다시 읽기' : '이어 읽기'}</b></span>
        </>}
        {p.status && <span className={'bk-status' + (p.status.on ? ' on' : '')}><i className="dot" />{p.status.text}</span>}
      </button>
      {p.actions && <div className="bk-actions">{p.actions}</div>}
    </li>
  );
}
