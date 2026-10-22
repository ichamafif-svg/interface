"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page">
      <div className="glass pad" style={{ borderColor: "rgba(248,113,113,.35)" }}>
        <div className="label">Backend Standard injoignable ou réponse invalide</div>
        <p className="c-bad mono" style={{ margin: "10px 0" }}>{error.message}</p>
        <p className="muted small">Une absence de réponse n&apos;est jamais affichée comme un zéro.</p>
        <button className="btn" type="button" onClick={reset}>Réessayer</button>
      </div>
    </main>
  );
}
