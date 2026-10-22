import Link from "next/link";

export default function NotFound() {
  return (
    <div className="aurora" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="glass pad" style={{ textAlign: "center" }}>
        <div className="label">404</div>
        <h1 style={{ fontSize: 26, margin: "8px 0" }}>Rien ici</h1>
        <p className="muted">Cet objet n&apos;existe pas, ou Standard ne le connaît pas encore.</p>
        <Link className="btn" href="/">Retour au Run</Link>
      </div>
    </div>
  );
}
