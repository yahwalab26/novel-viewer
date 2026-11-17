import { useState } from 'react';
import { DEVICES, type Device } from '../core/settings';

const ICON: Record<Device, string> = {
  auto: 'M4 5h12v8H4zM8 16h4',
  mobile: 'M7 3h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 15h2',
  tablet: 'M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 15h2',
};
/** 화면 크기(자동·모바일·태블릿·PC) 아코디언: 현재 값을 보여주는 행을 누르면 목록이 펼쳐지고, 고르면 접힌다. 뷰어 설정 패널에서 쓴다. */
export default function DeviceSwitch({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  const [open, setOpen] = useState(false);
  const cur = DEVICES.find(([d]) => d === value)?.[1] ?? '자동';
  return <div className={'acc' + (open ? ' open' : '')}>
    <button type="button" className="acc-h" aria-expanded={open} aria-controls="acc-device" onClick={() => setOpen(o => !o)}>
      <span>화면 크기</span><em>{cur}</em>
      <svg className="chev" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg></button>
    {open && <div id="acc-device" className="acc-list" role="group" aria-label="화면 크기">
      {DEVICES.map(([d, label]) => <button key={d} type="button" aria-pressed={value === d} className={value === d ? 'on' : ''} onClick={() => { onChange(d); setOpen(false); }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[d]} /></svg><span>{label}</span>{value === d && <b aria-hidden="true">✓</b>}</button>)}
    </div>}
  </div>;
}
