// eSpees settlement policy — inspectable accounting rules (§13.3).
// eSpees is INTERNAL settlement accounting, never a payment rail and never
// withdrawable by students. Splits/conversions/schedules marked TODO/DECISION
// stay configurable until product/business sign-off (PRD §21).

export const SETTLEMENT_POLICY = {
  /** Days after purchase before funds leave `pending`. */
  holdDays: Number(process.env.SETTLEMENT_HOLD_DAYS ?? 7),
  /** Lecturer share in basis points of gross. TODO(DECISION): confirm 70/30. */
  lecturerShareBps: Number(process.env.LECTURER_SHARE_BPS ?? 7000),
  /** Minimum payout per batch in kobo. TODO(DECISION): confirm with finance (0 = pay everything). */
  minPayoutKobo: Number(process.env.SETTLEMENT_MIN_PAYOUT_KOBO ?? 0),
  /** Human schedule description. TODO(DECISION): weekly vs twice-monthly. */
  schedule: process.env.SETTLEMENT_SCHEDULE ?? "weekly/manual-run",
  /** eSpees→Naira conversion for payout. TODO(DECISION): 1:1 assumed until locked. */
  espeesToNaira: Number(process.env.ESPEES_TO_NAIRA ?? 1),
  ruleVersion: "v1",
} as const;

export function nextPeriodEstimate(lastRunAt: Date | null): { nextRun: Date; note: string } {
  const base = lastRunAt ?? new Date();
  const nextRun = new Date(base.getTime() + 7 * 86400_000);
  return {
    nextRun,
    note: `Scheduled ${SETTLEMENT_POLICY.schedule}; matured entries (older than ${SETTLEMENT_POLICY.holdDays}d) release on each run.`,
  };
}
