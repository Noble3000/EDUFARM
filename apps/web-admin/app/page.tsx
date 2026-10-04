import { Icon } from "@edufarm/ui";

const LINKS = [
  { href: "/verifications", icon: "verify" as const, label: "Verification queues", body: "Approve students + lecturers." },
  { href: "/reviews", icon: "file" as const, label: "Material review queue", body: "Publish or reject lecturer submissions." },
  { href: "/settlements", icon: "wallet" as const, label: "eSpees settlement", body: "Run + pay out lecturer earnings." },
  { href: "/disputes", icon: "dispute" as const, label: "Disputes & reports", body: "Review and resolve." },
  { href: "/email", icon: "mail" as const, label: "Email outbox", body: "Receipts, grades, settlements." },
  { href: "/onboarding", icon: "school" as const, label: "Institution onboarding", body: "Requests + approvals." },
];

export default function Home() {
  return (
    <div className="card">
      <h2>Platform administration</h2>
      <p className="muted">Governance queues — approvals, publishing, payouts, and onboarding.</p>
      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
        {LINKS.map((l) => (
          <li key={l.href} style={{ padding: "8px 0", borderTop: "1px solid #F2F4F7" }}>
            <a href={l.href}>
              <Icon name={l.icon} size={14} /> {l.label}
            </a>{" "}
            <span className="muted">— {l.body}</span>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ marginTop: 10 }}>Institution onboarding arrives in Phase 4.</p>
    </div>
  );
}
