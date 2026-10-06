// Notification center — in-app is primary, email secondary.
// notify() writes the in-app row (deduplicated) and queues email for
// meaningful events unless the user muted that family or email entirely.
// Deep links point at the source object in the web apps.

import { prisma } from "../db.js";
import { emailFrom, getEmailProvider } from "./providers.js";

export const MAX_DRAIN_ATTEMPTS = 5;

export function backoffAt(attempts: number): Date {
  const minutes = Math.min(2 ** Math.max(0, attempts - 1) * 2, 240);
  return new Date(Date.now() + minutes * 60_000);
}

export async function getPrefs(userId: string) {
  const row = await prisma.notificationPref.findUnique({ where: { userId } });
  return { emailEnabled: row?.emailEnabled ?? true, mutedTypes: row?.mutedTypes ?? [] };
}

export async function emailAllowed(userId: string, kind: string): Promise<boolean> {
  const p = await getPrefs(userId);
  return p.emailEnabled && !p.mutedTypes.includes(kind);
}

export async function resolveEmail(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? null;
}

// Primary entry point for ALL in-app notifications.
export async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  dedupKey?: string;
  email?: { kind: string; subject?: string; force?: boolean };
}): Promise<{ created: boolean; id?: string }> {
  if (!opts.userId || opts.userId === "public") return { created: false };
  if (opts.dedupKey) {
    const dup = await prisma.notification.findUnique({
      where: { userId_dedupKey: { userId: opts.userId, dedupKey: opts.dedupKey } },
    });
    if (dup) return { created: false, id: dup.id };
  }
  const row = await prisma.notification.create({
    data: {
      userId: opts.userId, type: opts.type,
      title: opts.title.slice(0, 200), body: opts.body.slice(0, 2000),
      link: opts.link ?? null, dedupKey: opts.dedupKey ?? null,
    },
  });
  if (opts.email && (opts.email.force || (await emailAllowed(opts.userId, opts.email.kind)))) {
    await queueEmail({
      toUserId: opts.userId,
      subject: opts.email.subject ?? opts.title,
      body: `${opts.title}\n\n${opts.body}${opts.link ? `\n\nOpen: ${opts.link}` : ""}`,
      kind: opts.email.kind,
      eventKey: opts.dedupKey ? `notif:${opts.dedupKey}` : undefined,
    });
  }
  return { created: true, id: row.id };
}

// Email outbox with event-key idempotency: retried jobs NEVER duplicate email.
export async function queueEmail(opts: {
  toUserId: string;
  subject: string;
  body: string;
  kind?: string;
  eventKey?: string;
  toEmail?: string;
}): Promise<{ queued: boolean; id?: string }> {
  const toEmail = opts.toEmail ?? (await resolveEmail(opts.toUserId));
  if (!toEmail) return { queued: false };
  if (opts.eventKey) {
    const dup = await prisma.emailLog.findUnique({ where: { eventKey: opts.eventKey } });
    if (dup) return { queued: false, id: dup.id };
  }
  const row = await prisma.emailLog.create({
    data: {
      toUserId: opts.toUserId, toEmail,
      subject: opts.subject.slice(0, 200), body: opts.body.slice(0, 8000),
      kind: opts.kind ?? "general", eventKey: opts.eventKey ?? null,
      provider: process.env.EMAIL_PROVIDER?.toLowerCase() ?? "mock",
      status: "queued", attempts: 0,
    },
  });
  return { queued: true, id: row.id };
}

// Drain due outbox rows. Failed sends back off (2,4,8…240 min, 5 attempts max)
// then land in failed-delivery state with the last error stored.
export async function drainOutbox(limit = 25, force = false): Promise<{ sent: number; failed: number; deferred: number }> {
  const due = await prisma.emailLog.findMany({
    where: {
      status: { in: ["queued", "logged"] },
      ...(force ? {} : { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] }),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0, deferred = 0;
  for (const row of due) {
    const claimed = await prisma.emailLog.updateMany({
      where: { id: row.id, status: { in: ["queued", "logged"] } },
      data: { status: "sending" },
    });
    if (claimed.count === 0) {
      deferred += 1;
      continue; // another drainer took it — never double-send
    }
    const to = row.toEmail ?? (await resolveEmail(row.toUserId));
    if (!to) {
      await prisma.emailLog.update({ where: { id: row.id }, data: { status: "failed", lastError: "no recipient email" } });
      failed += 1;
      continue;
    }
    try {
      const provider = getEmailProvider(row.provider);
      const res = await provider.send({ to, subject: row.subject, text: row.body, replyTo: process.env.EMAIL_REPLY_TO });
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { status: "sent", messageId: res.messageId, sentAt: new Date(), provider: provider.name, lastError: null },
      });
      sent += 1;
    } catch (e) {
      const attempts = row.attempts + 1;
      const msg = (e as Error).message.slice(0, 300);
      if (attempts >= MAX_DRAIN_ATTEMPTS) {
        await prisma.emailLog.update({ where: { id: row.id }, data: { status: "failed", attempts, lastError: msg } });
        failed += 1;
      } else {
        await prisma.emailLog.update({
          where: { id: row.id },
          data: { status: "queued", attempts, lastError: msg, nextRetryAt: backoffAt(attempts) },
        });
        deferred += 1;
      }
    }
  }
  return { sent, failed, deferred };
}

export function frontendBase(): string {
  return (process.env.PAYMENT_CALLBACK_BASE ?? "http://localhost:3001").replace(/\/$/, "");
}

export { emailFrom };
