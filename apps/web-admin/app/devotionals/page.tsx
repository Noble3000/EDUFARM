"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, DataTable, EmptyState, Field, LoadingState, SuccessNote } from "@edufarm/ui";

type Row = {
  id: string; date: string; title: string; verse: string; body: string;
  sourceRef: string | null; origin: string; rightsNote: string | null;
};

export default function Devotionals() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [source, setSource] = useState<{ configured: boolean; note: string } | null>(null);
  const [f, setF] = useState({ date: "", title: "", verse: "", body: "", sourceRef: "", rightsNote: "" });
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  async function load() {
    setRows(await api("/devotional/archive").catch(() => null));
    setSource(await api("/devotional/source-status").catch(() => null));
  }
  useEffect(() => { load(); }, []);
  async function publish() {
    setOk("");
    setErr("");
    try {
      await api("/devotionals", {
        method: "POST",
        body: JSON.stringify({ ...f, sourceRef: f.sourceRef || undefined, rightsNote: f.rightsNote || undefined }),
      });
      setF({ date: "", title: "", verse: "", body: "", sourceRef: "", rightsNote: "" });
      setOk("Published — every student sees it on its Lagos day. Cache cleared.");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <div>
      <div className="card">
        <h2>Daily Word publishing</h2>
        <p className="muted">
          One canonical entry per Lagos day, same for every student. Manual entries here are the
          policy-approved fallback when the authorized source is unavailable — they are labeled
          honestly and never presented as source content.
        </p>
        <p className="muted">
          Source feed: {source ? (source.configured ? "connected" : `not connected — ${source.note}`) : "…"}
        </p>
        <Field label="Lagos date (YYYY-MM-DD)">
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Verse"><input value={f.verse} onChange={(e) => setF({ ...f, verse: e.target.value })} /></Field>
        <Field label="Body"><textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Source reference" optional hint="Where this text is authorized from.">
          <input value={f.sourceRef} onChange={(e) => setF({ ...f, sourceRef: e.target.value })} />
        </Field>
        <Field label="Rights note" optional hint="How long this entry may be shown/archived.">
          <input value={f.rightsNote} onChange={(e) => setF({ ...f, rightsNote: e.target.value })} />
        </Field>
        <button onClick={publish}>Publish entry</button>{" "}
        <button className="sec" onClick={async () => {
          setOk(""); setErr("");
          try {
            const r = await api("/devotional/refresh", { method: "POST", body: JSON.stringify({}) });
            setOk(r.refreshed ? `Source pull stored (origin: ${r.origin}).` : `No refresh: ${r.reason}.`);
            load();
          } catch (e) { setErr((e as Error).message); }
        }}>Pull from source now</button>
        {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
        {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      </div>
      <div className="card">
        <h3>Archive (newest first)</h3>
        {rows === null && <LoadingState label="Loading archive…" />}
        {rows !== null && !rows.length && <EmptyState icon="star" title="Archive empty" body="Publish the first entry above." />}
        {rows !== null && !!rows.length && (
          <DataTable caption="Devotional archive" head={["Date", "Title", "Origin", "Rights"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleDateString()}</td>
                <td><strong>{r.title}</strong> <span className="muted">{r.verse}</span></td>
                <td>{r.origin}{r.sourceRef ? ` · ${r.sourceRef}` : ""}</td>
                <td>{r.rightsNote ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
