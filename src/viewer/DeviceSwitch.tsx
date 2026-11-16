import { DEVICES, type Device } from '../core/settings';

const ICON: Record<Device, string> = {
  auto: 'M4 5h12v8H4zM8 16h4',
  mobile: 'M7 3h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 15h2',
  tablet: 'M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 15h2',
  desktop: 'M3 4h14v9H3zM7 17h6M10 13v4',
};
/** 화면 크기 전환(모바일·태블릿·PC). compact=상단 바용(자동 칸 없이, 켜진 버튼을 다시 누르면 자동으로 돌아감) */
export default function DeviceSwitch({ value, onChange, compact, className }: { value: Device; onChange: (d: Device) => void; compact?: boolean; className?: string }) {
  const opts = DEVICES.filter(([d]) => !compact || d !== 'auto');
  return <div className={'devsw' + (className ? ' ' + className : '')} role="group" aria-label="화면 크기 미리보기">
    {opts.map(([d, label]) => <button key={d} type="button" aria-pressed={value === d} className={value === d ? 'on' : ''}
      onClick={() => onChange(compact && value === d ? 'auto' : d)}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[d]} /></svg><span>{label}</span></button>)}
  </div>;
}
