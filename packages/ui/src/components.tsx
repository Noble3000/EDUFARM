// @edufarm/ui components — one shared language for student + lecturer + admin.
// Every control: >=44px target, real label, keyboard operable, visible focus ring,
// strong contrast, SVG icons only (no emoji). Business rules untouched.
"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

/* ---------- Field: label + control + hint/error (real <label> always) ---------- */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  success,
  children,
  optional,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  success?: string;
  optional?: boolean;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean | string; "aria-describedby"?: string }>;
}) {
  const auto = useId();
  const id = htmlFor ?? `f-${auto.replace(/[^a-zA-Z0-9]/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined,
  });
  return (
    <div style={{ margin: "2px 0 6px" }}>
      <label className="flabel" htmlFor={id}>
        {label} {optional && <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>}
      </label>
      {control}
      {hint && !error && <p className="hint" id={hintId}>{hint}</p>}
      {error && (
        <p className="field-err" id={errId} role="alert">
          <Icon name="x" size={13} /> {error}
        </p>
      )}
      {success && !error && (
        <p className="field-ok" role="status">
          <Icon name="check" size={13} /> {success}
        </p>
      )}
    </div>
  );
}

/* ---------- Alert: info/success/warn/error ---------- */
export function Alert({
  kind = "info",
  title,
  children,
  icon,
}: {
  kind?: "info" | "success" | "warn" | "error";
  title?: string;
  children: React.ReactNode;
  icon?: IconName;
}) {
  const map = {
    info: { cls: "alert-info", ic: "bell" as IconName, role: "status" as const },
    success: { cls: "alert-success", ic: "checkBadge" as IconName, role: "status" as const },
    warn: { cls: "alert-warn", ic: "clock" as IconName, role: "status" as const },
    error: { cls: "alert-error", ic: "x" as IconName, role: "alert" as const },
  }[kind];
  return (
    <div className={`alert ${map.cls}`} role={map.role}>
      <Icon name={icon ?? map.ic} size={16} />
      <div>
        {title && <strong style={{ display: "block", marginBottom: 2 }}>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Badge: typed trust/status pill ---------- */
export function Badge({ kind, icon, children }: { kind?: string; icon?: IconName; children: React.ReactNode }) {
  const cls =
    kind === "official" || kind === "ok" ? "b-off"
    : kind === "verified" || kind === "info" ? "b-ver"
    : kind === "urgent" || kind === "bad" || kind === "error" ? "b-urg"
    : kind === "points" || kind === "warn" ? "b-pts"
    : kind === "pink" ? "b-pink"
    : "b-ed";
  return (
    <span className={`badge ${cls}`}>
      {icon && <Icon name={icon} size={12} />} {children}
    </span>
  );
}

/* ---------- Tabs: keyboard arrow navigation ---------- */
export function Tabs({ tabs, initial = 0, onChange }: { tabs: { id: string; label: string; icon?: IconName }[]; initial?: number; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(initial);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function pick(i: number) {
    setActive(i);
    onChange?.(tabs[i].id);
  }
  function onKey(e: React.KeyboardEvent, i: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else n = tabs.length - 1;
    pick(n);
    refs.current[n]?.focus();
  }
  return (
    <div className="tabs" role="tablist" aria-label="Sections">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          aria-selected={i === active}
          className="tab"
          tabIndex={i === active ? 0 : -1}
          onClick={() => pick(i)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon && <Icon name={t.icon} size={14} />} {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal + Drawer: focus trap, Escape, overlay close, labelled ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement;
    // Move focus inside on open (first focusable, else the dialog itself).
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (first ?? box)?.focus?.();
    if (box && !box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      // Trap Tab inside the dialog.
      const items = [...box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={boxRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={wide ? { maxWidth: 720 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id={titleId} style={{ fontSize: 19 }}>{title}</h2>
          <button className="sec iconbtn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel = "Confirm", onConfirm, onCancel }: { title: string; body: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{body}</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="sec" onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ---------- Table shell: responsive + consistent head ---------- */
export function DataTable({ caption, head, children }: { caption: string; head: string[]; children: React.ReactNode }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <caption className="muted" style={{ textAlign: "left", padding: "10px 12px 0" }}>{caption}</caption>
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1
  );
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="sec" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <Icon name="chevL" size={14} /> Prev
      </button>
      {nums.map((n) => (
        <button key={n} className={n === page ? "" : "sec"} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
          {n}
        </button>
      ))}
      <button className="sec" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        Next <Icon name="chevR" size={14} />
      </button>
    </nav>
  );
}

/* ---------- Empty / loading / error / success ---------- */
export function EmptyState({ icon = "search", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ lines = 3, label = "Loading…" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="muted">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel" style={{ height: 18, margin: "10px 0" }} aria-hidden="true">.</div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error estate" role="alert">
      <Icon name="x" size={16} />
      <div>
        <strong style={{ display: "block", marginBottom: 2 }}>Something didn&apos;t load</strong>
        <div>{message}</div>
        {onRetry && (
          <div style={{ marginTop: 10 }}>
            <button className="sec" onClick={onRetry}><Icon name="arrowR" size={14} /> Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="snote" role="status">
      <Icon name="checkBadge" size={16} />
      <div>{children}</div>
    </div>
  );
}

/* ---------- OfflineNotice: network listener banner ---------- */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <Icon name="clock" size={16} />
      <span>
        <strong>You are offline.</strong> Shell assets are available. Protected academic materials, live submissions, and authentication require an active network connection.
      </span>
    </div>
  );
}

/* ---------- PWAInstallPrompt: beforeinstallprompt hook & banner ---------- */
export function PWAInstallPrompt({ appName = "EDUFARM" }: { appName?: string }) {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || dismissed) return null;
  if (!prompt) return null;

  async function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result && result.outcome === "accepted") {
      setInstalled(true);
    }
    setPrompt(null);
  }

  return (
    <div className="install-banner" role="region" aria-label="Install app">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="grad" size={20} />
        <div>
          <strong>Install {appName}</strong>
          <div className="muted" style={{ fontSize: 13 }}>Add to home screen for faster full-screen study and instant access.</div>
        </div>
      </div>
      <div className="row tight">
        <button onClick={handleInstall} style={{ padding: "8px 16px", minHeight: 44 }}>Install</button>
        <button className="sec" onClick={() => setDismissed(true)} style={{ padding: "8px 14px", minHeight: 44 }}>Dismiss</button>
      </div>
    </div>
  );
}

/* ---------- FileInput: mobile-first accessible file upload target ---------- */
export function FileInput({
  label = "Choose file",
  accept = ".pdf,.doc,.docx,.txt",
  hint = "PDF, DOCX, or text files up to 25MB",
  onFileSelect,
}: {
  label?: string;
  accept?: string;
  hint?: string;
  onFileSelect: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `edu-file-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    onFileSelect(selected);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  }

  return (
    <div style={{ margin: "6px 0 12px" }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
        id={inputId}
        aria-label={label}
      />
      <label
        htmlFor={inputId}
        className="file-dropzone"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <Icon name={file ? "file" : "upload"} size={22} />
        {file ? (
          <div>
            <strong>{file.name}</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              {(file.size / (1024 * 1024)).toFixed(2)} MB · Tap to replace
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="sec"
                onClick={handleClear}
                style={{ padding: "6px 14px", minHeight: 44 }}
              >
                Remove file
              </button>
            </div>
          </div>
        ) : (
          <div>
            <strong>{label}</strong>
            <div className="hint" style={{ margin: "2px 0 0" }}>{hint}</div>
          </div>
        )}
      </label>
    </div>
  );
}
