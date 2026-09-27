# EDUFARM ADR 002 — Better Auth + RBAC (locked 2026-09-27)

**Status:** Accepted.

## Decision
- Better Auth with Prisma Postgres adapter; tables `User/Session/Account/Verification` + `StudentProfile/LecturerProfile`.
- Session carries `role` + `verificationStatus`. Middleware matrix:
  - `student`: requires verified + enrolled for course/material APIs.
  - `lecturer`: requires verified + course ownership for publish/announce/grade.
  - `deptAdmin/institutionAdmin`: verification queues for their scope only.
  - `platformAdmin`: review queues, disputes, settlement.
- Separate login routes per portal sharing one Better Auth backend; no role-switching.
- TOTP 2FA enforced for all admin roles. Audit every verification transition in `AuditLog`.

## Rejected
Custom JWT, Auth.js, Clerk, Firebase, Supabase Auth.
