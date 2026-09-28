export default function Home() {
  return (
    <div className="card">
      <h2>Platform administration</h2>
      <p><a href="/verifications">Verification queues</a> — approve students + lecturers.</p>
      <p><a href="/reviews">Material review queue</a> — publish or reject lecturer submissions.</p>
      <p><a href="/settlements">eSpees settlement</a> — run + pay out lecturer earnings.</p>
      <p><a href="/disputes">Disputes & reports</a> — review and resolve.</p>
      <p><a href="/email">Email outbox</a> — receipts, grades, settlements.</p>
      <p><a href="/onboarding">Institution onboarding</a> — requests + approvals.</p>
      <p className="muted">Institution onboarding arrives in Phase 4.</p>
    </div>
  );
}
