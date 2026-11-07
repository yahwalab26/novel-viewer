import { useCallback, useEffect, useState } from 'react';
import type { Api } from './server/api';
import type { AssignRow, AuthorRow, BookRow } from './server/books';

export default function AssignPanel({ api, book, onClose }: { api: Api; book: BookRow; onClose: () => void }) {
  const [authors, setAuthors] = useState<AuthorRow[] | null>(null);
  const [rows, setRows] = useState<Map<string, AssignRow>>(new Map());
  const [msg, setMsg] = useState(''); const [email, setEmail] = useState('');
  const load = useCallback(async () => {
    try { const [a, r] = await Promise.all([api.books.authors(), api.books.assignments(book.id)]); setAuthors(a); setRows(new Map(r.map(x => [x.author_id, x]))); }
    catch (e) { setMsg((e as Error).message); setAuthors([]); }
  }, [api, book.id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<void>) => { setMsg(''); try { await fn(); await load(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="modal" role="dialog" aria-label="작가 배정" onClick={onClose}>
      <div className="sheetbox" onClick={e => e.stopPropagation()}>
        <div className="phead"><b>‘{book.title}’ 작가·공유</b><button className="link" onClick={onClose}>닫기</button></div>
        <div className="pbody">
          <p className="hint">공유를 끄면 작가는 즉시 이 원고와 자신의 형광펜·메모를 볼 수 없게 됩니다. (다시 켜면 복구)</p>
          {msg && <p className="err" role="alert">{msg}</p>}
          {authors === null ? <p>불러오는 중…</p> : authors.length === 0 ? <p className="hint">등록된 작가가 없습니다. 아래에서 이메일로 추가하세요.</p> :
            authors.map(a => { const r = rows.get(a.id); return (
              <div className="arow" key={a.id}>
                <div className="who2"><b>{a.name || a.email}</b><small>{a.email}</small></div>
                {!r ? <button className="primary sm" onClick={() => run(() => api.books.assign(book.id, a.id))}>배정</button> : (
                  <div className="aopts">
                    <label className="opt">공유<button role="switch" aria-checked={r.enabled} className={'sw' + (r.enabled ? ' on' : '')} onClick={() => run(() => api.books.updateAssign(book.id, a.id, { enabled: !r.enabled }))}><i /></button></label>
                    <label className="opt"><input type="checkbox" checked={r.allow_copy} onChange={() => run(() => api.books.updateAssign(book.id, a.id, { allow_copy: !r.allow_copy }))} />복사 허용</label>
                    <button className="link" onClick={() => run(() => api.books.unassign(book.id, a.id))}>해제</button>
                  </div>)}
              </div>); })}
          <div className="addauthor"><b>작가 추가</b>
            <p className="hint">정산 사이트에 계정이 있는 작가는 뷰어에 처음 로그인하면 이 목록에 자동으로 나타납니다. 로그인 전에 미리 넣으려면 그 이메일을 입력하세요.</p>
            <div className="addrow"><input type="email" placeholder="작가 이메일" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="primary sm" disabled={!email.trim()} onClick={() => run(async () => { await api.books.addAuthor(email); setEmail(''); })}>추가</button></div></div>
        </div>
      </div>
    </div>
  );
}
