import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle } from "@/components/ui";
import { FailModeToggle } from "@/components/actions";
import { refHref } from "@/lib/refs";

export const metadata = { title: "Transférer · Protections" };

const DEC: Record<string, string> = { removal_in_progress: "v", ready_to_switch: "q", stays_in_product: "u", business_rule: "p", waiting: "p" };

export default async function Transfer({ params, searchParams }: { params: Promise<{ product: string; zone: string }>; searchParams: Promise<{ t?: string }> }) {
  const { product, zone } = await params;
  const { t } = await searchParams;
  const data = await unwrap(api().GET("/products/{product}/zones/{zone}/transfers", { params: { path: { product, zone } } }));
  const sel = data.items.find((x) => x.id === t) ?? data.items.find((x) => x.stepLabels) ?? data.items[0];

  return (
    <main className="page">
      <PageHead
        kicker="Transfert des protections"
        title="Le contrôle change de main, sous preuve"
        intro="L'IA retire l'ancien code une fois le nouveau point d'application et ses refus démontrés. Les règles qui exigent l'état de l'objet restent dans le produit."
      />
      {sel?.stepLabels && (
        <section className="glass pad">
          <SectionTitle right={<Chip cls={DEC[sel.decision] ?? "p"}>{sel.decisionLabel}</Chip>}>Contrôle sélectionné · {sel.control}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {sel.stepLabels.map((l, i) => {
              const done = i < sel.stepsDone;
              const cur = i === sel.stepsDone;
              return (
                <div key={l} className={`card${cur ? " active" : ""}`}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: done ? "rgba(74,222,128,.14)" : cur ? "rgba(165,180,252,.14)" : "rgba(255,255,255,.05)", color: done ? "var(--ok)" : cur ? "var(--accent)" : "var(--muted)" }}>{done ? "✓" : i + 1}</span>
                  <div style={{ marginTop: 8, fontSize: 13 }}>{l}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="glass tablewrap">
        <table>
          <thead><tr><th>Contrôle dans le code</th><th>Nouveau point d&apos;application</th><th>Avancement</th><th>Décision</th></tr></thead>
          <tbody>
            {data.items.map((x) => (
              <tr key={x.id} className={x.id === sel?.id ? "sel" : undefined}>
                <td><Link href={`?t=${x.id}`} style={{ color: "var(--fg)" }}>{x.control}</Link><div className="mono muted">{x.location}</div></td>
                <td>{x.target}<div className="muted small">{x.targetDetail}</div></td>
                <td>
                  <div className="flex" style={{ gap: 3 }}>
                    {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 16, height: 6, borderRadius: 999, background: x.blockedAt === i + 1 ? "#f87171" : i < x.stepsDone ? "#4ade80" : "rgba(255,255,255,.08)" }} />)}
                  </div>
                  <div className="muted small" style={{ marginTop: 6 }}>{x.status}</div>
                </td>
                <td><Chip cls={DEC[x.decision] ?? "p"} dot={DEC[x.decision] !== "p"}>{x.decisionLabel}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="row">
        {sel?.proof && (
          <section className="glass pad grow">
            <SectionTitle>Preuve bornée</SectionTitle>
            <div className="flex">{sel.proof.points.map((pt) => <Chip key={pt} cls="o">{pt}</Chip>)}</div>
            <p style={{ margin: "12px 0 0" }}>{sel.proof.statement}</p>
          </section>
        )}
        <section className="glass pad side">
          <SectionTitle>Si l&apos;entrée tombe</SectionTitle>
          {data.failModes.map((f) => (
            <div key={f.route} className="between" style={{ padding: "8px 0" }}>
              <span className="mono" style={{ fontSize: 13 }}>{f.route}</span>
              <FailModeToggle product={product} route={f.route} mode={f.mode} />
            </div>
          ))}
          <p className="muted small" style={{ margin: "8px 0 0" }}>Choix humain par route, signé et tracé dans la chronologie.</p>
        </section>
      </div>
      {sel?.removal && (
        <section className="glass pad">
          <SectionTitle>Retrait de l&apos;ancien code</SectionTitle>
          <p style={{ margin: 0 }}>
            L&apos;IA retire <span className="mono">{sel.removal.file}</span> (candidat {sel.removal.candidateId}), réversible par Git. La configuration de la plateforme s&apos;exporte telle quelle si vous quittez Standard.
          </p>
          <div className="flex" style={{ marginTop: 12 }}>
            <Link className="btn" href={refHref(product, { kind: "candidate", id: sel.removal.candidateId })}>Voir le candidat</Link>
          </div>
        </section>
      )}
    </main>
  );
}
