// Academic Points policy — single inspectable source of truth (§12).
// Every awardable event is defined here; anything not listed CANNOT award.
// Amounts marked TODO/DECISION are explicitly unresolved business numbers —
// do not treat current values as final (economic modelling pending, PRD §21).

export const POINTS_RULE_VERSION = "v1";

export interface PointsEvent {
  /** Stable key stored on every ledger row (`reason`). */
  key: string;
  /** Points per occurrence. TODO(DECISION): finalize after economic modelling. */
  amount: number;
  /** How the once-only idempotency key is derived. */
  idempotency: string;
  description: string;
}

export const POINTS_EVENTS: Record<string, PointsEvent> = {
  "assessment-pass": {
    key: "assessment-pass",
    // TODO(DECISION): confirm 10 pts; consider scaling by score band.
    amount: 10,
    idempotency: "pass:{assessmentId}:{studentId} — one award per assessment, forever",
    description: "Graded assessment score ≥ 50%. Never for opens, purchases, or attempts alone.",
  },
  "lecturer-recognition": {
    key: "lecturer-recognition",
    // TODO(DECISION): confirm 5 pts; confirm quotas below.
    amount: 5,
    idempotency: "rec:{week}:{lecturerId}:{studentId}:{clientNonce} — capped, see quotas",
    description: "Lecturer award for genuine participation/answers/improvement.",
  },
};

export const POINTS_QUOTAS = {
  // TODO(DECISION): confirm quotas after abuse modelling.
  recognitionWeeklyPerLecturer: 20,
  recognitionWeeklyPerLecturerPerStudent: 2,
} as const;

export const POINTS_REDEMPTION = {
  // TODO(DECISION): confirm ratio, floor, and ceiling with finance.
  koboPerPoint: 10,
  minRedeemPoints: 5000,
  maxPriceShare: 0.5,
} as const;

export const POINTS_INVARIANTS = [
  "non-cash: points are never withdrawable and never convert to eSpees or Naira",
  "no-award-on-open: reading, opening, or previewing grants nothing",
  "no-award-on-purchase: spending money grants nothing",
  "slow: thresholds require sustained activity over weeks, not sessions",
] as const;
