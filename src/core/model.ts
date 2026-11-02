// 공통 데이터 모델 — 모든 포맷은 이 구조로 변환된다. 뷰어는 이것만 안다.
export type Format = 'epub' | 'docx' | 'hwpx' | 'hwp';

export type Block =
  | { type: 'p'; text: string }          // 일반 문단 (웹소설은 대부분 이것)
  | { type: 'scene' }                    // 장면 구분(빈 줄/***)
  | { type: 'h'; text: string }          // 소제목
  | { type: 'img'; ref: string };        // 이미지(선택, 후순위)

export interface Chapter { id: string; title: string; blocks: Block[]; charCount: number }

export interface Book {
  id: string;               // 파일 해시 기반 (중복 등록 방지)
  title: string;
  author?: string;
  format: Format;
  parserVersion: number;    // 파서 개선 시 재파싱 판단용
  chapters: Chapter[];
  addedAt: number;
}

export type BookSummary = Omit<Book, 'chapters'> & { chapterCount: number; charCount: number };

export interface ReadingState {   // 이어읽기
  bookId: string; chapterId: string; blockIndex: number; updatedAt: number;
}
export interface Bookmark { id: string; bookId: string; chapterId: string; blockIndex: number; memo?: string; createdAt: number }

export interface ViewerSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontFamily: string; fontSize: number; lineHeight: number; paragraphGap: number;
  mode: 'scroll' | 'page';
}

// ---- 확장 지점 1: 파서 (포맷 추가 = 이 인터페이스 구현 1개) ----
export interface Parser {
  format: Format;
  extensions: string[];
  parse(data: ArrayBuffer, fileName: string): Promise<Omit<Book, 'id' | 'addedAt'>>;
}

// ---- 확장 지점 2: 저장소 (지금 Local, 나중에 Remote로 교체) ----
export interface LibraryRepository {
  saveBook(book: Book, source: Blob): Promise<void>;
  listBooks(): Promise<BookSummary[]>;
  getBook(id: string): Promise<Book | null>;
  deleteBook(id: string): Promise<void>;
  getState(bookId: string): Promise<ReadingState | null>;
  saveState(s: ReadingState): Promise<void>;
  listBookmarks(bookId: string): Promise<Bookmark[]>;
  saveBookmark(b: Bookmark): Promise<void>;
  listAnnotations(bookId: string): Promise<Annotation[]>;
  saveAnnotation(a: Annotation): Promise<void>;
  deleteAnnotation(bookId: string, id: string): Promise<void>;
}

// ---- 권한: 편집자는 전체 관리, 작가는 본인에게 배정된 원고만 열람 ----
export type Role = 'editor' | 'author';
export interface User { id: string; name: string; role: Role }
export interface Assignment {            // 작가별 원고 배정 + 공유 ON/OFF (편집자만 변경)
  bookId: string; authorId: string; enabled: boolean; allowCopy: boolean; updatedAt: number;
}

// ---- 형광펜/메모 (작가가 작성, 편집자 열람 가능). 원고가 개정돼도 quote로 위치 재탐색 ----
export interface Annotation {
  id: string; bookId: string; authorId: string; chapterId: string;
  blockIndex: number; start: number; end: number;   // 문단 내 글자 위치
  quote: string;                                    // 선택 원문(개정본 재매칭용)
  color: 'yellow' | 'green' | 'pink' | 'blue';
  memo?: string; createdAt: number; updatedAt: number;
}
