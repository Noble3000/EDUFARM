// Shared domain types (mirrors Prisma models in apps/api/prisma/schema.prisma).
// Zod schemas land here in Phase 0.3 so web + api validate identically.

export type Role = "student" | "lecturer" | "deptAdmin" | "institutionAdmin" | "platformAdmin";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type EnrollmentStatus = "requested" | "approved" | "rejected" | "removed";
export type MaterialStatus = "draft" | "pendingLecturer" | "pendingReview" | "published" | "archived";
export type QuestionStatus = "unanswered" | "answered" | "resolved";
export type PurchaseStatus = "pending" | "completed" | "failed" | "refunded";
export type LedgerStatus = "pending" | "available" | "settled";
