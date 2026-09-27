// @edufarm/reader — protected viewer contract (R2 page-streaming).
// Real canvas viewer lands with Phase 1 spike. This file locks the API both apps use.

export interface PageUrl {
  page: number;
  url: string; // 60s R2 presigned URL
  expiresAt: string;
}

export interface ReaderSession {
  materialId: string;
  version: number;
  pageCount: number;
  resumePage: number;
  watermark: string; // "Name · STU-042 · timestamp · course"
}

// Client must: disable context menu/print, overlay watermark, report dwell per page.
export function watermarkText(displayName: string, userCode: string, course: string, when: string): string {
  return `${displayName} · ${userCode} · ${when} · ${course} · Do not redistribute`;
}
