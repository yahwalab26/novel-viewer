export const TAG: { paraHeader: number; paraText: number; ctrlHeader: number; listHeader: number };
export const utf16: (s: string) => Buffer;
export const wide: (code: number) => string;
export function rec(tag: number, level: number, data: Buffer): Buffer;
export function para(text: string, opts?: { level?: number; extra?: Buffer[] }): Buffer;
export function ctrl(id: string, level: number): Buffer;
export function list(level: number): Buffer;
export function buildHwp(o: { sections: Buffer[]; flags?: number; title?: string; author?: string; signature?: string }): Buffer;
