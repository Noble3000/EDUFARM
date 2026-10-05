"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, EmptyState, ErrorState, LoadingState } from "@edufarm/ui";

type Item = {
  kind: "paid" | "free";
  purchaseId: string | null; studentId: string;
  materialId: string | null; materialTitle: string | null;
  versionGranted: number | null; versionCurrent: number | null;
  editionReplaced: boolean;
  courseId: string | null; courseCode: string | null; courseTitle: string | null;
  accessType: string; accessStart: string;
  accessEnd: string | null; permanent: boolean;
  orderRef: string | null; classification: "paid" | "free";
  amountKobo: number; pointsUsed: number;
  state: "active" | "expiring" | "expired" | "archived" | "revoked" | "suspended";
  stateReason: string | null;
};
type Lib = {
  items: Item[];
  summary: { active: number; expiring: number; expired: number; archived: number; revoked: number; suspended: number; permanent: number };
  purchases: unknown[]; freeMaterials: { id: string; title: string }[];
};

const STATE_BADGE: Record<Item["state"], string> = {
  active: "b-off", expiring: "b-warn", expired: "b-bad",
  archived: "b-ed", revoked: "b-bad", suspended: "b-warn",
};
const STATE_LABEL: Record<Item["state"], string> = {
  active: "Active", expiring: "Expiring soon", expired: "Expired",
  archived: "Archived edition", revoked: "Revoked", suspended: "Suspended",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function ItemCard({ it }: { it: Item }) {
  return (
    <div style={{ borderTop: "1px solid #F2F4F7", paddingTop: 10, marginTop: 6 }}>
      <p style={{ marginBottom: 4 }}>
        {it.materialId ? (
          <a href={`/materials/${it.materialId}`}><strong>{it.materialTitle ?? it.materialId}</strong></a>
        ) : (
          <strong>{it.materialTitle ?? "Item"}</strong>
        )}{" "}
        <span className={`badge ${STATE_BADGE[it.state]}`}>{STATE_LABEL[it.state]}</span>
        <span className="badge b-ed">{it.classification === "paid" ? "Paid" : "Free"}</span>
        {it.permanent && (it.state === "active" || it.state === "expiring") && <span className="badge b-off">Permanent access</span>}
      </p>
      <p className="muted" style={{ marginBottom: 4 }}>
        {it.courseCode && <>{it.courseCode} · </>}
        {it.versionGranted != null && <>edition v{it.versionGranted}{it.versionCurrent != null && it.versionCurrent !== it.versionGranted && <> (latest v{it.versionCurrent})</>} · </>}
        {it.accessType} access · since {fmtDate(it.accessStart)} ·{" "}
        {it.permanent ? "no expiry" : it.accessEnd ? `until ${fmtDate(it.accessEnd)}` : "ends if enrollment ends"}
        {it.orderRef && <> · order <strong>{it.orderRef}</strong></>}
        {it.pointsUsed > 0 && <> · {it.pointsUsed} pts used</>}
      </p>
      {it.editionReplaced && <p className="muted">A newer edition exists — your granted edition stays readable. <a href={it.materialId ? `/materials/${it.materialId}` : "/library"}>Open latest</a>.</p>}
      {it.stateReason && it.state !== "active" && <p className="muted">{it.stateReason}</p>}
      {(it.state === "expired") && it.materialId && (
        <p><a className="btn sec" href={`/materials/${it.materialId}`}>Renew access</a></p>
      )}
      {(it.state === "revoked" || it.state === "suspended") && (
        <p className="muted">Contact your course lecturer about this grant.</p>
      )}
    </div>
  );
}

export default function Library() {
  const [lib, setLib] = useState<Lib | null>(null);
  const [failed, setFailed] = useState("");
  const [filter, setFilter] = useState<"all" | Item["state"] | "permanent">("all");
  async function load() {
    setFailed("");
    try {
      setLib(await api("/library/me"));
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load your library.");
    }
  }
  useEffect(() => { load(); }, []);
  if (!lib && !failed) return <LoadingState label="Loading your library…" />;
  if (failed && !lib) return <ErrorState message={failed} onRetry={load} />;
  const items = lib?.items ?? [];
  const visible = items.filter((i) =>
    filter === "all" ? true : filter === "permanent" ? i.permanent : i.state === filter
  );
  const s = lib?.summary;
  return (
    <div>
      <h2>My Academic Library</h2>
      <p className="muted">Every item is an entitlement: edition, course, type, start, end, order and validity — not just a file.</p>
      <div className="card">
        <div className="row" role="group" aria-label="Filter by access state">
          {(["all", "active", "expiring", "expired", "archived", "permanent"] as const).map((f) => (
            <button key={f} className={filter === f ? "" : "sec"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? `All (${items.length})` : f === "permanent" ? `Permanent (${s?.permanent ?? 0})` : `${f} (${s?.[f as keyof typeof s] ?? 0})`}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>{filter === "all" ? "Everything" : filter === "permanent" ? "Permanent / long-term access" : STATE_LABEL[filter as Item["state"]]}</h3>
        {visible.map((it) => <ItemCard key={`${it.kind}-${it.purchaseId ?? it.materialId}`} it={it} />)}
        {!visible.length && (
          <EmptyState
            icon="library"
            title={filter === "all" ? "Library empty" : `Nothing ${filter}`}
            body={filter === "all"
              ? "Paid materials you unlock and free official notes from approved courses will live here with full access terms."
              : "No items in this state right now."}
            action={<a className="btn sec" href="/courses">Browse courses</a>}
          />
        )}
      </div>
    </div>
  );
}
