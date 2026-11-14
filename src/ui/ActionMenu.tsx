import { useCallback, useRef, useState } from 'react';
import { useDismiss } from './useDismiss';
import { useMenuPlacement } from './placeMenu';

export interface MenuItem { label: string; onSelect: () => void; danger?: boolean }
/** '더보기' 같은 단추를 누르면 네모난 메뉴 상자가 열린다(항목을 고르면 닫힘). */
export default function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const menu = useRef<HTMLDivElement>(null); const pos = useMenuPlacement(open, btn, menu);
  useDismiss(open, close, box, btn);
  return (
    <div className="acct-wrap" ref={box}>
      <button ref={btn} type="button" className="bk-act" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}</button>
      {open && (
        <div ref={menu} className={'menu menu-left' + (pos.up ? ' up' : '') + (pos.right ? ' at-right' : '')} role="menu">
          {items.map(it => <button key={it.label} type="button" role="menuitem" className={'item' + (it.danger ? ' danger' : '')} onClick={() => { setOpen(false); it.onSelect(); }}>{it.label}</button>)}
        </div>
      )}
    </div>
  );
}
