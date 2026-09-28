"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function EmailOutbox() {
  const [rows, setRows] = useState<{ id: string; toUserId: string; subject: string; body: string; status: string }[]>([]);
  useEffect(() => { api("/email/outbox").then(setRows).catch(() => []); }, []);
  return (
    <div className="card">
      <h2>Email outbox (dev transport: logged)</h2>
      <p className="muted">Purchases, grades, and settlements write here. Prod worker (Resend/Postmark) drains `logged` rows.</p>
      {rows.map((e) => (
        <p key={e.id}>· <strong>{e.subject}</strong> → {e.toUserId.slice(0, 8)}… [{e.status}]<br /><span className="muted">{e.body}</span></p>
      ))}
      {!rows.length && <p className="muted">Empty (or log in as platform admin first).</p>}
    </div>
  );
}
