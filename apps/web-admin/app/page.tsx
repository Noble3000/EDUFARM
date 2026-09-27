export default function Home() {
  return (
    <div className="card">
      <h2>Platform administration</h2>
      <p><a href="/verifications">Verification queues</a> — approve students + lecturers.</p>
      <p><a href="/reviews">Material review queue</a> — publish or reject lecturer submissions.</p>
      <p className="muted">Disputes, settlement, and institution onboarding arrive in Phase 2–4.</p>
    </div>
  );
}
