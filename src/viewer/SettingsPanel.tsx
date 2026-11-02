import type { ReactNode } from 'react';
import { THEMES, DEFAULT_SETTINGS, type ViewerSettings } from '../core/settings';
import { THEME_COLORS, FONTS, LH_DEFAULT, GAP_DEFAULT } from './theme';

type P = { s: ViewerSettings; set: (p: Partial<ViewerSettings>) => void; close: () => void };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

function Row({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <div className="row"><div className="lbl">{label}{value && <em>{value}</em>}</div><div className="ctl">{children}</div></div>;
}
function Stepper({ dec, inc, reset, label }: { dec: () => void; inc: () => void; reset?: () => void; label: string }) {
  return <div className="stepper">
    {reset && <button onClick={reset} aria-label={`${label} 원본으로`}>↺</button>}
    <button onClick={dec} aria-label={`${label} 줄이기`}>−</button><button onClick={inc} aria-label={`${label} 늘리기`}>+</button></div>;
}
function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <Row label={label}><button role="switch" aria-checked={on} disabled={disabled} className={'sw' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button></Row>;
}
function Select<T extends string>({ label, value, opts, onChange, disabled }: { label: string; value: T; opts: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return <Row label={label}><select value={value} disabled={disabled} onChange={e => onChange(e.target.value as T)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>;
}

export default function SettingsPanel({ s, set, close }: P) {
  const scroll = s.mode === 'scroll';
  const lh = s.lineHeight === 'original' ? LH_DEFAULT : s.lineHeight;
  const gap = s.paragraphGap === 'original' ? GAP_DEFAULT : s.paragraphGap;
  return (
    <div className="panel" role="dialog" aria-label="뷰어 설정" onClick={e => e.stopPropagation()}>
      <div className="phead"><b>뷰어 설정</b><button className="link" onClick={close}>닫기</button></div>
      <div className="pbody">
        <div className="themes" role="radiogroup" aria-label="배경색">{THEMES.map(t =>
          <button key={t} role="radio" aria-checked={s.theme === t} aria-label={THEME_COLORS[t].label}
            className={s.theme === t ? 'sel' : ''} style={{ background: THEME_COLORS[t].bg }} onClick={() => set({ theme: t })} />)}</div>
        <Row label="밝기"><input type="range" min={0.3} max={1} step={0.05} value={s.brightness} onChange={e => set({ brightness: +e.target.value })} aria-label="밝기" /></Row>
        <h4>글자·문단</h4>
        <Select label="글꼴" value={s.fontFamily} opts={Object.entries(FONTS).map(([k, v]) => [k, v.label] as [string, string])} onChange={v => set({ fontFamily: v })} />
        <Row label="글자 크기" value={String(s.fontSizeLevel)}><Stepper label="글자 크기" dec={() => set({ fontSizeLevel: clamp(s.fontSizeLevel - 1, 1, 10) })} inc={() => set({ fontSizeLevel: clamp(s.fontSizeLevel + 1, 1, 10) })} /></Row>
        <Row label="줄 간격" value={s.lineHeight === 'original' ? '원본' : String(lh)}><Stepper label="줄 간격" reset={() => set({ lineHeight: 'original' })} dec={() => set({ lineHeight: clamp(r1(lh - 0.1), 1.2, 2.6) })} inc={() => set({ lineHeight: clamp(r1(lh + 0.1), 1.2, 2.6) })} /></Row>
        <Row label="문단 간격" value={s.paragraphGap === 'original' ? '원본' : String(gap)}><Stepper label="문단 간격" reset={() => set({ paragraphGap: 'original' })} dec={() => set({ paragraphGap: clamp(r1(gap - 0.2), 0, 2.4) })} inc={() => set({ paragraphGap: clamp(r1(gap + 0.2), 0, 2.4) })} /></Row>
        <Row label="문단 너비" value={String(s.paragraphWidthLevel)}><Stepper label="문단 너비" dec={() => set({ paragraphWidthLevel: clamp(s.paragraphWidthLevel - 1, 1, 5) })} inc={() => set({ paragraphWidthLevel: clamp(s.paragraphWidthLevel + 1, 1, 5) })} /></Row>
        <Select label="문단 정렬" value={s.align} opts={[['original', '원본'], ['left', '왼쪽'], ['justify', '양쪽']]} onChange={v => set({ align: v })} />
        <Toggle label="형광펜 보기" on={s.highlight} onChange={v => set({ highlight: v })} />
        <h4>읽기 방식</h4>
        <Toggle label="스크롤보기" on={scroll} onChange={v => set({ mode: v ? 'scroll' : 'page' })} />
        {scroll && <p className="hint">스크롤보기에서는 터치 설정, 넘김 효과, 하단 정보, 두쪽보기를 사용할 수 없습니다.</p>}
        <Select label="좌/우 터치 영역" disabled={scroll} value={s.tapZones.left} opts={[['prev', '이전 / 다음'], ['next', '다음 / 이전']]}
          onChange={v => set({ tapZones: { left: v, right: v === 'prev' ? 'next' : 'prev' } })} />
        <Toggle label="상/하 터치로 페이지 이동" disabled={scroll} on={s.verticalTapPaging} onChange={v => set({ verticalTapPaging: v })} />
        <Select label="페이지 넘김 효과" disabled={scroll} value={s.pageTurnEffect} opts={[['none', '없음'], ['fade', '서서히 나타남'], ['slide', '밀기']]} onChange={v => set({ pageTurnEffect: v })} />
        <Toggle label="가로모드에서 두쪽보기" disabled={scroll} on={s.twoPageLandscape} onChange={v => set({ twoPageLandscape: v })} />
        <Select label="하단 왼쪽 정보" disabled={scroll} value={s.bottomInfo.left} opts={[['none', '표시 안 함'], ['time', '현재 시각'], ['chapter', '회차 제목']]} onChange={v => set({ bottomInfo: { ...s.bottomInfo, left: v } })} />
        <Select label="하단 오른쪽 정보" disabled={scroll} value={s.bottomInfo.right} opts={[['none', '표시 안 함'], ['page', '페이지'], ['percent', '진행률']]} onChange={v => set({ bottomInfo: { ...s.bottomInfo, right: v } })} />
        <Toggle label="화면 항상 켜짐" on={s.keepScreenOn} onChange={v => set({ keepScreenOn: v })} />
        <button className="link reset" onClick={() => set({ ...DEFAULT_SETTINGS })}>설정 초기화</button>
        <p className="hint ver">웹소설 뷰어 v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
