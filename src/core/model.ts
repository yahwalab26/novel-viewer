// 공통 데이터 모델 — 모든 포맷은 이 구조로 변환된다. 뷰어는 이것만 안다.
export type Format = 'epub' | 'docx' | 'hwpx' | 'hwp' | 'pdf';

/** 글자 모양 구간. s·e = 문단 text 의 글자 위치(s 이상 e 미만). i 기울임 · b 굵게 · u 밑줄 · x 취소선 */
export interface Mark { s: number; e: number; i?: 1; b?: 1; u?: 1; x?: 1 }
/** gap = 이 블록 바로 앞에 엔터만 친 빈 줄이 몇 줄 있었는지(원고의 빈 줄 그대로 보이게). 없으면 0 */
export type Block =
  | { type: 'p'; text: string; marks?: Mark[]; gap?: number }   // 일반 문단 (웹소설은 대부분 이것). marks 없으면 서식 없음(옛 원고 호환)
  | { type: 'scene'; text?: string; gap?: number }    // 장면 구분 줄(***, ◇◇◇ 등). 원문 그대로 보여 주려고 text 를 보관(예전에 저장된 것은 없음 → 빈 간격)
  | { type: 'h'; text: string; gap?: number }          // 소제목
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
  progress?: number;            // 원고 전체 기준 읽은 비율 0~1 (서재 진행 막대용)
}
export interface Bookmark { id: string; bookId: string; chapterId: string; blockIndex: number; label?: string; createdAt: number }

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

// 뷰어가 필요로 하는 최소 저장소(형광펜). 로컬/서버 저장소가 모두 만족한다.
export type BookmarkStore = Pick<LibraryRepository, 'listBookmarks' | 'saveBookmark' | 'deleteBookmark'>;
export type AnnotationStore = Pick<LibraryRepository, 'listAnnotations' | 'saveAnnotation' | 'deleteAnnotation'>;

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
  deleteBookmark(bookId: string, id: string): Promise<void>;
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
