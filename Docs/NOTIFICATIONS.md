# EDUFARM Notifications — in-app primary, email secondary

> Rule: business logic NEVER touches an email SDK. All sending flows through
> `apps/api/src/notify/` (provider adapter) and the `EmailLog` outbox.

## Channels

- **In-app (primary):** `Notification` rows with `type/title/body/link`, read via
  `/notifications/me`, unread badge via `/notifications/unread-count`, center at
  `/notifications` (all three apps), mark read / read-all.
- **Email (secondary, meaningful events only):** queued `EmailLog` rows with
  `kind` (event family) + `eventKey` (idempotency), sent by the drain through
  the configured provider. Retried jobs can NEVER duplicate email
  (`eventKey` UNIQUE — duplicates collapse to the existing row).

## The 10 events

| Event | In-app (link) | Email kind |
| :--- | :--- | :--- |
| New announcement | yes (`/courses/:id`) | `announcement` |
| New material / revision | yes (`/materials/:id`) | `material` / `material-revision` |
| Purchase confirmation | yes | `purchase` (receipt) |
| Receipt/order confirmation | — (same receipt row) | `purchase` |
| Assessment update (publish/grade/release) | yes (`/assessments/:id`) | `assessment` |
| Assignment deadline reminder | yes (`/assessments/:id`) | `deadline` (48h horizon, idempotent reruns) |
| Course access approval/status | yes (`/courses/:id`) | `enrollment` |
| Material revision (authorized users) | yes | `material-revision` |
| Account/platform notice (verification, institution) | yes (`/verify`) | `verification` / `institution` / `dispute` |
| Dispute/verification status | yes | `dispute` |

## Guarantees

- **Dedup:** `Notification(userId, dedupKey)` UNIQUE absorbs repeat fires;
  `EmailLog.eventKey` UNIQUE absorbs retried queues.
- **Preferences:** `NotificationPref` — email on/off + per-family mutes.
  In-app is never muted. Checked at queue time.
- **Read state:** `readAt` per row; cross-user reads 404.
- **Retry policy:** drain claims rows (`queued → sending` conditional — two
  drainers never double-send), exponential backoff 2/4/8…240 min, 5 attempts
  max, then `failed` with `lastError` stored. `POST /email/:id/retry` re-queues.
- **Deep links:** every actionable notification carries a frontend route.

## Providers

`EMAIL_PROVIDER=mock|resend|sendgrid|smtp` (+ `EMAIL_API_KEY`, `EMAIL_FROM`,
`EMAIL_REPLY_TO`, `SMTP_HOST/PORT/USER/PASSWORD`). Mock logs + records (local
E2E, no money, no network). Resend/SendGrid are plain HTTPS. SMTP is implicit
TLS (465) + AUTH LOGIN with zero new dependencies.

## Operations (local-first)

- Drain now: `POST /email/drain?limit=25` (platform admin). `?force=true`
  skips backoff in test mode only.
- Deadline sweep: `POST /notifications/reminders/run` (staff) — schedule it
  (cron/PM2) for the 48h horizon; reruns are no-ops by dedup key.
- Reconcile the queue: `GET /email/outbox?status=failed`, retry, re-drain.
