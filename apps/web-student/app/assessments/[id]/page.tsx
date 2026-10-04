"use client";
import { useEffect, useState } from "react";
import { Crumb } from "@edufarm/ui";
import { api } from "@/lib/api";

type Q = { id: string; text: string; kind: string; options: string[]; marks: number };

export default function Attempt({ params }: { params: { id: string } }) {
  const [qs, setQs] = useState<Q[]>([]);
  const [title, setTitle] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [ans, setAns] = useState<Record<string, { selectedIndex?: number; body?: string }>>({});
  const [result, setResult] = useState<{ status: string; score: number | null; maxScore: number | null } | null>(null);
  const [msg, setMsg] = useState("");

  async function start() {
    setMsg("…");
    try {
      const r = await api(`/assessments/${params.id}/start`, { method: "POST", body: JSON.stringify({}) });
      setAttemptId(r.attempt.id);
      setTitle(r.assessment.title);
      setQs(r.assessment.questions);
      setMsg("");
    } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { start(); }, [params.id]);

  async function submit() {
    try {
      const r = await api(`/attempts/${attemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: Object.entries(ans).map(([questionId, a]) => ({ questionId, ...a })),
        }),
      });
      setResult({ status: r.status, score: r.score, maxScore: r.maxScore });
    } catch (e) { setMsg((e as Error).message); }
  }

  if (result) {
    return (
      <div className="card">
        <h2>{title} — {result.status}</h2>
        {result.score != null
          ? <p>Score: <strong>{result.score}/{result.maxScore}</strong> (auto-graded)</p>
          : <p>Submitted — theory answers await lecturer grading.</p>}
        <p><a href="/">Back home</a></p>
      </div>
    );
  }
  return (
    <div>
      <Crumb trail={[{ href: '/', label: 'Home' }, { label: 'Assessment' }]} />
      <h2>{title || "Assessment"}</h2>
      {qs.map((q, i) => (
        <div className="card" key={q.id}>
          <p><strong>Q{i + 1} ({q.marks} mk{ q.marks > 1 ? "s" : ""})</strong> — {q.text}</p>
          {q.kind === "mcq" ? (
            q.options.map((o, oi) => (
              <label key={oi} style={{ display: "block", margin: "6px 0" }}>
                <input type="radio" style={{ width: "auto" }} name={q.id} checked={ans[q.id]?.selectedIndex === oi}
                  onChange={() => setAns({ ...ans, [q.id]: { selectedIndex: oi } })} /> {o}
              </label>
            ))
          ) : (
            <textarea value={ans[q.id]?.body ?? ""} onChange={(e) => setAns({ ...ans, [q.id]: { body: e.target.value } })} rows={4} />
          )}
        </div>
      ))}
      {attemptId && <button onClick={submit}>Submit answers</button>}
      <p>{msg}</p>
    </div>
  );
}
