// Email provider adapter — the ONLY place email SDKs/HTTP/SMTP live.
// Business logic calls logEmail()/drainOutbox(), never a provider directly.
// EMAIL_PROVIDER=mock|resend|sendgrid|smtp. All secrets from environment.
// Zero new dependencies: Resend/SendGrid are plain HTTPS; SMTP is implemented
// over implicit TLS (port 465) with AUTH LOGIN using node:tls.

import { connect } from "node:tls";
import { fetchWithRetry } from "../lib/http.js";

export type EmailProviderName = "mock" | "resend" | "sendgrid" | "smtp";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface SendResult {
  messageId: string;
  raw: unknown;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(msg: EmailMessage): Promise<SendResult>;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function emailProviderName(): EmailProviderName {
  const p = (process.env.EMAIL_PROVIDER ?? "mock").toLowerCase();
  return p === "resend" || p === "sendgrid" || p === "smtp" ? p : "mock";
}

export function emailFrom(): string {
  return env("EMAIL_FROM") ?? "EDUFARM <noreply@edufarm.ng>";
}

// ---------------------------------------------------------------- mock ---
export class MockEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "mock";
  async send(msg: EmailMessage): Promise<SendResult> {
    const id = `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[email:mock] to=${msg.to} subject=${msg.subject} id=${id}`);
    return { messageId: id, raw: { mock: true } };
  }
}

// --------------------------------------------------------------- resend ---
export class ResendEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "resend";
  async send(msg: EmailMessage): Promise<SendResult> {
    const key = env("EMAIL_API_KEY");
    if (!key) throw new Error("EMAIL_API_KEY not configured for resend.");
    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom(), to: [msg.to], subject: msg.subject, text: msg.text,
        ...(msg.replyTo ?? env("EMAIL_REPLY_TO") ? { reply_to: msg.replyTo ?? env("EMAIL_REPLY_TO") } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) throw new Error(`Resend failed: ${data.message ?? res.status}`);
    return { messageId: data.id, raw: data };
  }
}

// ------------------------------------------------------------- sendgrid ---
export class SendGridEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "sendgrid";
  async send(msg: EmailMessage): Promise<SendResult> {
    const key = env("EMAIL_API_KEY");
    if (!key) throw new Error("EMAIL_API_KEY not configured for sendgrid.");
    const res = await fetchWithRetry("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: emailFrom() },
        reply_to: { email: msg.replyTo ?? env("EMAIL_REPLY_TO") ?? emailFrom() },
        subject: msg.subject,
        content: [{ type: "text/plain", value: msg.text }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SendGrid failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const messageId = res.headers.get("x-message-id") ?? `sg_${Date.now().toString(36)}`;
    return { messageId, raw: { status: res.status } };
  }
}

// ----------------------------------------------------------------- smtp ---
// Minimal implicit-TLS SMTP client (port 465 default): EHLO, AUTH LOGIN,
// MAIL FROM, RCPT TO, DATA, QUIT. No new dependencies.
export class SmtpEmailProvider implements EmailProvider {
  readonly name: EmailProviderName = "smtp";
  async send(msg: EmailMessage): Promise<SendResult> {
    const host = env("SMTP_HOST");
    const port = Number(env("SMTP_PORT") ?? 465);
    const user = env("SMTP_USER");
    const pass = env("SMTP_PASSWORD");
    if (!host || !user || !pass) throw new Error("SMTP_HOST/SMTP_USER/SMTP_PASSWORD not configured.");
    const from = emailFrom();
    const fromAddr = /<([^>]+)>/.exec(from)?.[1] ?? from;
    const lines = [
      `From: ${from}`,
      `To: ${msg.to}`,
      `Subject: ${msg.subject}`,
      `Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@edufarm>`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      msg.text,
    ];
    await smtpSend({ host, port, user, pass, from: fromAddr, to: msg.to, data: lines.join("\r\n") });
    return { messageId: `smtp_${Date.now().toString(36)}`, raw: { host, port } };
  }
}

function smtpSend(opts: { host: string; port: number; user: string; pass: string; from: string; to: string; data: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: opts.host, port: opts.port, servername: opts.host }, () => {});
    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
    let buf = "";
    let step = 0;
    let bodyAccepted = false;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP timeout."));
    }, 20000);
    const done = (err?: Error) => {
      clearTimeout(timer);
      socket.destroy();
      err ? reject(err) : resolve();
    };
    const send = (line: string) => socket.write(line + "\r\n");
    socket.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\r\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        if (line.length >= 4 && line[3] === "-") continue; // multiline reply: wait for final line
        const code = line.slice(0, 3);
        if (!/^[23]/.test(code) && step > 0) {
          done(new Error(`SMTP rejected: ${line.slice(0, 120)}`));
          return;
        }
        step += 1;
        if (bodyAccepted) {
          bodyAccepted = false;
          send(`QUIT`);
          done();
          return;
        }
        if (step === 1) send(`EHLO edufarm`);
        else if (step === 2) send(`AUTH LOGIN`);
        else if (step === 3) send(b64(opts.user));
        else if (step === 4) send(b64(opts.pass));
        else if (step === 5) send(`MAIL FROM:<${opts.from}>`);
        else if (step === 6) send(`RCPT TO:<${opts.to}>`);
        else if (step === 7) send(`DATA`);
        else if (step === 8) {
          socket.write(opts.data + "\r\n.\r\n");
          bodyAccepted = true;
        }
      }
    });
    socket.on("error", (e) => done(e instanceof Error ? e : new Error(String(e))));
  });
}

export function getEmailProvider(name?: string): EmailProvider {
  const p = (name ?? emailProviderName()).toLowerCase();
  if (p === "resend") return new ResendEmailProvider();
  if (p === "sendgrid") return new SendGridEmailProvider();
  if (p === "smtp") return new SmtpEmailProvider();
  return new MockEmailProvider();
}
